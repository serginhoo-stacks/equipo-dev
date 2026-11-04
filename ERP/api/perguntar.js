export default async function handler(req, res) {

try {

const { pergunta } = req.body;


const resposta = await fetch(
"https://api.groq.com/openai/v1/chat/completions",
{
method:"POST",

headers:{
"Content-Type":"application/json",
"Authorization":"Bearer " + process.env.GROQ_API_KEY
},

body:JSON.stringify({

model:"llama-3.1-8b-instant",

messages:[

{
role:"system",
content:
"Você é o SmartInspect AI, especialista em engenharia civil, inspeção de obras e construção. Responda de forma técnica e objetiva."
},

{
role:"user",
content:pergunta
}

]

})

}
);


const dados = await resposta.json();


if(dados.error){

throw new Error(dados.error.message);

}


res.status(200).json({

resposta:
dados.choices[0].message.content

});


}catch(error){

console.log(error);

res.status(500).json({

resposta:"Erro na IA: " + error.message

});

}

}
