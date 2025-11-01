import message from "../models/message.js";
import user from "../models/user.js";
import cloudinary from "../lib/cloudinary.js";
import {io,usersocketmap} from "../server.js";

export const getuserforsidebar =async (req,res)=>{
    try{
        const userId = req.user._id;
        const filteredusers=await user.find({_id:{$ne:userId}}).select("-password");

        const unseenmessages = {}
        const promises = filteredusers.map(async(user)=>{
            const messages= await message.find({senderId:user._id, receiverId: userId, seen:false
            })
            if(messages.length>0){
                unseenmessages[user._id]=messages.length;
            }
        })
        await Promise.all(promises);
        res.json({success:true,users:filteredusers,unseenmessages})
    }
 catch (error ){
    console.log(error.message);
    res.json({success:false,message:error.message})

 
    }
}

export const getmessages = async (req,res)=>{
    try{
        const {id:selecteduserId}=req.params;
        const myId=req.user._id;
        const messages = await message.find({
            $or:[
                {senderId:myId,receiverId:selecteduserId},
                {senderId:selecteduserId,receiverId:myId},
            ]
        })
        await message.updateMany({senderId:selecteduserId,receiverId:myId},{seen:true});

        res.json({success:true,messages})
    } catch (error){
        console.log(error.message);
        res.json({success:false,message:error.message})
    }

}
export const markmessageasseen = async(req,res)=>{
    try{
        const {id}=req.params;
        await message.findByIdAndUpdate(id,{seen:true})
            res.json({success:true})
        

    }catch  (error){
        console.log(error.message);
        res.json({success:false,message:error.message})
    }
}


//send to selected user

export const sendmessage = async (req,res)=>{
    try{

        const {text,image}=req.body;
        const receiverId=req.params.id;
        const senderId=req.user._id;

        let imageurl;
        if(image){
            const uploadresponse=await cloudinary.uploader.upload(image)
            imageurl=uploadresponse.secure_url;

        }


        const newmessage = await message.create({
            senderId,
            receiverId,
            text,
            image: imageurl
        })

        const receiversocketid=usersocketmap[receiverId];
        if(receiversocketid){
            io.to(receiversocketid).emit("newmessages",newmessage)
        }




        res.json({success:true,newmessage});


    }catch  (error){
        console.log(error.message);
        res.json({success:false,message:error.message})
    }
}