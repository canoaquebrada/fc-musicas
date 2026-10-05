import {json} from "../../lib/quack.mjs";
export default async function handler(req,res){
  if(req.method!=="GET")return json(res,405,{error:"Método não permitido"});
  return json(res,200,{orders:[],analytics:{},note:"No deploy da Vercel os pedidos são encaminhados diretamente ao WhatsApp configurado."});
}
