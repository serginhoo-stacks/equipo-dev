export default async function handler(req,res){

try{

const resposta = await fetch(
"https://api.groq.com/openai/v1/models",
{
headers:{
"Authorization":
"Bearer " + process.env.GROQ_API_KEY
}
}
);


const dados = await resposta.text();


res.status(200).send(dados);


}catch(error){

res.status(500).send(error.message);

}

}
