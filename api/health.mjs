import {json} from "../lib/quack.mjs";
export default async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Método não permitido"});
  return json(res,200,{ok:true,service:"fc-musicas-personalizadas",provider:"quackapi",model:process.env.QUACKAPI_MODEL||"duckai/gpt-5.6-luna",whatsapp:process.env.WHATSAPP_NUMBER||"5585992019111"});
}
