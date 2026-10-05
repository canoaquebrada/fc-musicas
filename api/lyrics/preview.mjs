import {generateLyrics,json,normalizeAnswers,validateAnswers} from "../../lib/quack.mjs";
export default async function handler(req,res){
  if(req.method!=="POST")return json(res,405,{error:"Método não permitido"});
  try{
    const a=normalizeAnswers(req.body||{});
    const missing=validateAnswers(a);
    if(missing.length)return json(res,400,{error:"Preencha: "+missing.join(", ")});
    const result=await generateLyrics(a);
    return json(res,200,result);
  }catch(error){
    console.error("lyrics_preview_error",error?.message||error);
    return json(res,502,{error:"Não foi possível criar a letra agora. Tente novamente."});
  }
}
