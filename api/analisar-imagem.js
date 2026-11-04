export default async function handler(req, res) {


try {


if(req.method !== "POST"){

return res.status(405).json({
erro:"Método não permitido"
});

}



const chunks=[];


for await (const chunk of req){

chunks.push(chunk);

}



const buffer=Buffer.concat(chunks);



const contentType =
req.headers["content-type"] || "image/jpeg";



const base64 =
buffer.toString("base64");





const resposta = await fetch(

"https://api.groq.com/openai/v1/chat/completions",

{

method:"POST",

headers:{


"Authorization":

"Bearer " + process.env.GROQ_API_KEY,


"Content-Type":

"application/json"


},



body:JSON.stringify({


model:
"meta-llama/llama-4-scout-17b-16e-instruct",



messages:[



{

role:"system",

content:

`
Você é o SmartInspect AI.

Especialista em inspeção de obras.

Analise imagens de construção civil.

Identifique:

- fissuras
- trincas
- infiltrações
- umidade
- corrosão
- problemas de acabamento
- riscos estruturais

Responda sempre:

1. Problema encontrado
2. Nível de atenção (baixo, médio ou alto)
3. Recomendação técnica
`

},



{

role:"user",

content:[

{

type:"text",

text:

"Analise esta imagem de uma inspeção de obra."

},


{

type:"image_url",

image_url:{

url:

`data:${contentType};base64,${base64}`

}

}


]


}


]



})


}

);






const dados =
await resposta.json();






if(dados.error){

throw new Error(
dados.error.message
);

}






res.status(200).json({

analise:

dados.choices[0].message.content

});





}

catch(error){


console.log(error);



res.status(500).json({

erro:

error.message

});


}


}
