(() => {
  "use strict";

  const db = window.banco;
  const $ = (id) => document.getElementById(id);
  if (!db || !$("startAudioCall")) return;

  const state = {
    userId: null,
    conversation: null,
    peer: null,
    channel: null,
    channelId: null,
    channelReady: false,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    callId: null,
    mode: null,
    isCaller: false,
    pendingOffer: null,
    pendingCandidates: [],
    localCandidateQueue: [],
    canSignalCandidates: false,
    ringTimeout: null,
  };

  const privateTopic = (id) => `smartinspect-call:${id}`;
  const showStatus = (text, error = false) => {
    const node = $("callStatus");
    node.textContent = text || "";
    node.classList.toggle("error-text", Boolean(error));
  };
  const openDialog = () => {
    const dialog = $("callDialog");
    if (!dialog.open) dialog.showModal();
  };
  const setMode = (mode) => {
    state.mode = mode;
    $("callAudioMark").hidden = mode !== "audio";
    $("remoteCallVideo").classList.toggle("call-audio-only", mode === "audio");
    $("localCallVideo").hidden = mode !== "video";
    $("toggleCamera").hidden = mode !== "video";
    $("callModeLabel").textContent = mode === "video" ? "Chamada de vídeo" : "Chamada de áudio";
  };
  const peerId = () => state.peer?.id || null;
  const callStatus = (text) => {
    $("callDialogTitle").textContent = text;
  };
  const explainCallError = (error) => {
    const name = error?.name || "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return "Permissão de microfone/câmera bloqueada. Autorize o acesso no navegador e tente novamente.";
    }
    if (name === "NotFoundError") {
      return "Nenhum microfone ou câmera disponível neste dispositivo.";
    }
    if (name === "NotReadableError") {
      return "O microfone ou a câmera já está sendo usado por outro aplicativo.";
    }
    if (name === "SecurityError" || !window.isSecureContext) {
      return "Chamadas exigem HTTPS ou localhost. Abra o sistema por uma conexão segura.";
    }
    if (error?.message) return error.message;
    return "Não foi possível iniciar a chamada. Verifique o Supabase Realtime e as permissões do navegador.";
  };
  const updateCallActions = (incoming = false, active = false) => {
    $("acceptCall").hidden = !incoming;
    $("declineCall").hidden = !incoming;
    $("toggleMicrophone").hidden = !active;
    $("toggleCamera").hidden = !active || state.mode !== "video";
    $("endCall").hidden = !active && !incoming;
  };

  async function setConversation(conversation, userId) {
    if (state.conversation?.conversa_id === conversation?.conversa_id && state.userId === userId) return;
    await finishCall("hangup", true);
    if (state.channel) {
      await db.removeChannel(state.channel);
      state.channel = null;
    }
    state.channelReady = false;
    state.channelId = null;
    state.conversation = conversation || null;
    state.userId = userId || null;
    state.peer = (conversation?.participantes || []).find((p) => !p.is_me) || null;

    const eligible = Boolean(
      state.conversation?.tipo === "privada" && state.peer?.id && state.userId,
    );
    $("startAudioCall").hidden = !eligible;
    $("startVideoCall").hidden = !eligible;
    if (eligible) {
      try {
        await ensureCallChannel();
      } catch (error) {
        showStatus(error.message || "Não foi possível ativar o canal privado de chamadas.", true);
      }
    }
  }

  async function ensureCallChannel() {
    const id = state.conversation?.conversa_id;
    if (!id || state.conversation?.tipo !== "privada") throw new Error("As chamadas estão disponíveis apenas em conversas privadas.");
    if (state.channel && state.channelId === id && state.channelReady) return;
    if (state.channel) await db.removeChannel(state.channel);
    state.channelId = id;
    state.channelReady = false;

    const channel = db.channel(privateTopic(id), {
      config: { private: true, broadcast: { self: false, ack: true } },
    });
    state.channel = channel;
    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void receiveSignal(payload || {});
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("O canal privado de chamadas demorou a conectar. Confirme a migração de segurança."));
      }, 12000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && !settled) {
          settled = true;
          clearTimeout(timer);
          state.channelReady = true;
          resolve();
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !settled) {
          settled = true;
          clearTimeout(timer);
          reject(new Error("Canal de chamadas indisponível. A migração de chamadas pode ainda não ter sido aplicada."));
        }
      });
    });
  }

  async function sendSignal(type, fields = {}) {
    if (!state.channel || !state.channelReady || !state.conversation || !state.peer) {
      throw new Error("O canal privado da conversa não está conectado.");
    }
    const result = await state.channel.send({
      type: "broadcast",
      event: "signal",
      payload: {
        type,
        call_id: state.callId,
        conversation_id: state.conversation.conversa_id,
        from: state.userId,
        to: peerId(),
        mode: state.mode,
        ...fields,
      },
    });
    if (result !== "ok") throw new Error("Não foi possível enviar a sinalização da chamada.");
  }

  async function sendQueuedCandidates() {
    const pending = state.localCandidateQueue.splice(0);
    state.canSignalCandidates = true;
    for (const candidate of pending) await sendSignal("candidate", { candidate });
  }

  async function startCall(mode) {
    if (!state.conversation || state.conversation.tipo !== "privada" || !state.peer) {
      showStatus("Abra uma conversa privada para iniciar uma chamada.", true);
      return;
    }
    if (state.callId) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      showStatus("Este navegador não disponibiliza chamadas WebRTC.", true);
      return;
    }
    try {
      await ensureCallChannel();
      state.callId = crypto.randomUUID();
      state.isCaller = true;
      state.pendingCandidates = [];
      state.localCandidateQueue = [];
      state.canSignalCandidates = false;
      setMode(mode);
      callStatus("A iniciar chamada…");
      showStatus(`Chamando ${state.peer.nome || "pessoa"}. Mantenha esta conversa aberta. O navegador pedirá acesso ao ${mode === "video" ? "microfone e à câmera" : "microfone"}.`);
      updateCallActions(false, true);
      openDialog();
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === "video",
      });
      $("localCallVideo").srcObject = state.localStream;
      await createPeerConnection();
      const offer = await state.peerConnection.createOffer();
      await state.peerConnection.setLocalDescription(offer);
      await sendSignal("offer", { description: state.peerConnection.localDescription });
      await sendQueuedCandidates();
      callStatus(`Ligando para ${state.peer.nome || "pessoa"}…`);
      state.ringTimeout = window.setTimeout(() => {
        void finishCall("cancel", true, "Sem resposta. A chamada foi encerrada.");
      }, 60000);
    } catch (error) {
      console.error("Falha ao iniciar chamada privada:", error);
      await finishCall("cancel", false);
      showStatus(explainCallError(error), true);
      openDialog();
      updateCallActions(false, false);
      $("endCall").hidden = false;
      callStatus("Não foi possível iniciar");
    }
  }

  async function createPeerConnection() {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    state.peerConnection = pc;
    state.remoteStream = new MediaStream();
    $("remoteCallVideo").srcObject = state.remoteStream;
    for (const track of state.localStream.getTracks()) {
      pc.addTrack(track, state.localStream);
    }
    pc.ontrack = (event) => {
      const streams = event.streams?.[0];
      if (streams) {
        for (const track of streams.getTracks()) {
          if (!state.remoteStream.getTracks().some((existing) => existing.id === track.id)) state.remoteStream.addTrack(track);
        }
      } else if (!state.remoteStream.getTracks().some((existing) => existing.id === event.track.id)) {
        state.remoteStream.addTrack(event.track);
      }
      void $("remoteCallVideo").play().catch(() => {});
    };
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON();
      if (!state.canSignalCandidates) state.localCandidateQueue.push(candidate);
      else void sendSignal("candidate", { candidate }).catch((error) => showStatus(error.message, true));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        clearTimeout(state.ringTimeout);
        state.ringTimeout = null;
        callStatus(state.mode === "video" ? "Chamada de vídeo ativa" : "Chamada de áudio ativa");
        showStatus("Ligação estabelecida.");
      } else if (pc.connectionState === "failed") {
        void finishCall("hangup", true, "A rede não conseguiu estabelecer a chamada. Uma conexão TURN pode ser necessária nesta rede.");
      } else if (pc.connectionState === "disconnected") {
        showStatus("Ligação interrompida; tentando reconectar…", true);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed") {
        void finishCall("hangup", true, "A ligação falhou. Uma conexão TURN pode ser necessária nesta rede.");
      }
    };
    return pc;
  }

  async function receiveSignal(signal) {
    if (
      !state.conversation ||
      state.conversation.tipo !== "privada" ||
      signal.conversation_id !== state.conversation.conversa_id ||
      signal.to !== state.userId ||
      signal.from !== peerId()
    ) return;

    if (signal.type === "offer") {
      if (state.callId) {
        if (signal.call_id !== state.callId) {
          try {
            await sendSignal("busy", { call_id: signal.call_id, to: signal.from });
          } catch {}
        }
        return;
      }
      state.callId = signal.call_id;
      state.mode = signal.mode === "video" ? "video" : "audio";
      state.pendingOffer = signal.description;
      state.isCaller = false;
      state.pendingCandidates = [];
      setMode(state.mode);
      openDialog();
      callStatus(`Chamada recebida de ${state.peer.nome || "pessoa"}`);
      showStatus(state.mode === "video" ? "Chamada de vídeo recebida." : "Chamada de áudio recebida.");
      updateCallActions(true, false);
      return;
    }
    if (!state.callId || signal.call_id !== state.callId) return;

    if (signal.type === "answer" && state.isCaller && state.peerConnection) {
      clearTimeout(state.ringTimeout);
      state.ringTimeout = null;
      await state.peerConnection.setRemoteDescription(signal.description);
      await applyPendingCandidates();
      callStatus("Conectando…");
    } else if (signal.type === "candidate" && signal.candidate) {
      if (state.peerConnection?.remoteDescription) {
        try {
          await state.peerConnection.addIceCandidate(signal.candidate);
        } catch (error) {
          console.warn("Candidato ICE ignorado:", error);
        }
      } else {
        state.pendingCandidates.push(signal.candidate);
      }
    } else if (signal.type === "reject") {
      await finishCall("", false, "A chamada foi recusada.");
    } else if (signal.type === "busy") {
      await finishCall("", false, "A outra pessoa já está numa chamada.");
    } else if (["hangup", "cancel"].includes(signal.type)) {
      await finishCall("", false, signal.type === "cancel" ? "A chamada foi cancelada." : "A chamada foi encerrada pela outra pessoa.");
    }
  }

  async function applyPendingCandidates() {
    if (!state.peerConnection?.remoteDescription) return;
    const pending = state.pendingCandidates.splice(0);
    for (const candidate of pending) {
      try {
        await state.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.warn("Candidato ICE pendente ignorado:", error);
      }
    }
  }

  async function acceptCall() {
    if (!state.pendingOffer || !state.callId) return;
    try {
      showStatus("Pedindo acesso ao microfone e à câmera…");
      state.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: state.mode === "video",
      });
      $("localCallVideo").srcObject = state.localStream;
      await createPeerConnection();
      await state.peerConnection.setRemoteDescription(state.pendingOffer);
      await applyPendingCandidates();
      const answer = await state.peerConnection.createAnswer();
      await state.peerConnection.setLocalDescription(answer);
      await sendSignal("answer", { description: state.peerConnection.localDescription });
      await sendQueuedCandidates();
      state.pendingOffer = null;
      callStatus("Conectando…");
      showStatus("A ligar…");
      updateCallActions(false, true);
    } catch (error) {
      try { await sendSignal("reject"); } catch {}
      await finishCall("", false);
      showStatus(error.message || "Não foi possível atender. Confira as permissões de microfone/câmera.", true);
      openDialog();
      callStatus("Não foi possível atender");
      $("endCall").hidden = false;
    }
  }

  async function finishCall(signalType = "hangup", notify = true, message = "Chamada encerrada.") {
    clearTimeout(state.ringTimeout);
    state.ringTimeout = null;
    if (notify && state.callId && state.channelReady) {
      try { await sendSignal(signalType); } catch (error) { console.warn("Não foi possível enviar o encerramento da chamada:", error); }
    }
    if (state.peerConnection) {
      state.peerConnection.ontrack = null;
      state.peerConnection.onicecandidate = null;
      state.peerConnection.close();
    }
    state.peerConnection = null;
    state.localStream?.getTracks().forEach((track) => track.stop());
    state.localStream = null;
    state.remoteStream = null;
    $("localCallVideo").srcObject = null;
    $("remoteCallVideo").srcObject = null;
    state.callId = null;
    state.mode = null;
    state.isCaller = false;
    state.pendingOffer = null;
    state.pendingCandidates = [];
    state.localCandidateQueue = [];
    state.canSignalCandidates = false;
    $("callDialog").close();
    if (message) showStatus(message);
  }

  $("startAudioCall").addEventListener("click", () => void startCall("audio"));
  $("startVideoCall").addEventListener("click", () => void startCall("video"));
  $("acceptCall").addEventListener("click", () => void acceptCall());
  $("declineCall").addEventListener("click", () => void finishCall("reject", true, "Chamada recusada."));
  $("endCall").addEventListener("click", () => void finishCall(state.isCaller ? "cancel" : "hangup", true));
  $("toggleMicrophone").addEventListener("click", () => {
    const track = state.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $("toggleMicrophone").textContent = track.enabled ? "Microfone ligado" : "Microfone desligado";
    $("toggleMicrophone").setAttribute("aria-pressed", String(!track.enabled));
  });
  $("toggleCamera").addEventListener("click", () => {
    const track = state.localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    $("toggleCamera").textContent = track.enabled ? "Câmera ligada" : "Câmera desligada";
    $("toggleCamera").setAttribute("aria-pressed", String(!track.enabled));
  });
  $("callDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    void finishCall(state.isCaller ? "cancel" : "hangup", true);
  });

  window.addEventListener("smartinspect:conversation", (event) => {
    void setConversation(event.detail?.conversation, event.detail?.userId);
  });
  window.addEventListener("beforeunload", () => {
    try { state.peerConnection?.close(); } catch {}
    try { state.localStream?.getTracks().forEach((track) => track.stop()); } catch {}
  });
})();
