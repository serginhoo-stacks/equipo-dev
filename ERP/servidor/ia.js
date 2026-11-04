import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";


dotenv.config();


const app = express();

app.use(cors());

app.use(express.json());


const openai = new OpenAI({

apiKey: process.env.OPENAI_API_KEY

});




app.post("/perguntar", async(req,res)=>{


try{


const resposta = await openai.chat.completions.create({

model:"gpt-4.1-mini",

messages:[

{

role:"system",

content:
"Você é um engenheiro especialista em inspeção de obras."

},

{

role:"user",

content:req.body.pergunta

}

]


});



res.json({

resposta:

resposta.choices[0].message.content

});



}catch(error){


console.log(error);


res.status(500).json({

erro:"Erro na IA"

});


}



});







app.listen(3000,()=>{

console.log("IA SmartInspect rodando");

});
