const express=require('express');
const jwt=require('jsonwebtoken');
const bodyParser=require('body-parser');
const SHA256 = require("crypto-js/sha256");

const mongoose = require('mongoose');

require('dotenv').config();

mongoose.connect(process.env.PRODURL || "mongodb://localhost:27017/RC");

//SETTING UP SCHEMA
var Schema=mongoose.Schema;
var userSchema=new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        unique:true,
        required:true
    },
    phone:{
        type:String,
        unique:true,
        required:true
    },

    invitesSent:[
        {
            name:{
                type:String,
            },
            email:{
                type:String
            }
        }
    ],
    regno:{
        type:String,
        unique:true,
        required:true
    },
    password:{
        type:String,
        required:true
    },
    teamCreated:{
        type:String,
        default:null
    },
    team:{
        type:String,
        default:null
    },
    pending:[{
        teamname:{
            type:String,
        },
        creater:{
            name:{
                type:String,
            },
            email:{
                type:String,
            }
        },        
    }]
});
var user=mongoose.model('user',userSchema);
var teamSchema=new Schema({
    name:{
        type:String,
        unique:true,
        required:true
    },
    creater:
        {
            name:{
                type:String,
            },
            email:{
                type:String,
            }
        },
    member:
        {
            name:{
                type:String,
            },
            email:{
                type:String,
            }
        },
});
var team=mongoose.model('team',teamSchema);

//SETUP APP
var app=express();
app.use(bodyParser.json({ type: 'application/json' }))

//EXPRESS MIDDLEWARE FOR CORS
function cors(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','*');
    res.setHeader('Access-Control-Max-Age',1728000); 
    res.setHeader('Access-Control-Request-Methods',"*");
    res.setHeader('Access-Control-Expose-Headers','Authorization');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Origin, Accept,Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
    next();
};



//EXPRESS MIDDLEWRE FOR AUTHORIZATION
function authorization(req,res,next){
    if(req.get('Authorization')==undefined){
        res.status(401).send();
    }
    else{
        jwt.verify(req.get('Authorization'),process.env.SECRET, function(err, decoded) {
            if(err){
                console.log(err);
                res.status(401).send('Unauthorised');
            } else {
                console.log(decoded.email);
                if(decoded.email!=req.body.email || Date.now()-decoded.timestamp>86400000){
                    res.status(401).send('Try logging in again');
                }
                else{
                    res.header('Authorization',req.get('Authorization'));
                    next();
                }
            }    
        });
    }    
}

app.get('/',function(req,res){
    res.send('WORKING')
})

//HANDLING SIGNUP
//OPTIONS ADDED TO ENABLE CORS WITH JSON DATA
//INPUT NAME EMAIL REGNO PASSWORD PHONE
//TEAM SET TO NULL AS DEFAULT
app.options('/signup',cors,function(req,res){
    res.send();
})
app.post('/signup',cors,function(req,res){
    if(req.body.email==undefined || req.body.phone==undefined || req.body.name==undefined || req.body.regno==undefined || req.body.password==undefined){
        res.status(404).send('Enter all details')
    } else{
        user.create({
            email:req.body.email,name:req.body.name,phone:req.body.phone,regno:req.body.regno,password:SHA256(req.body.password),team:null
        },function(err,docs){
            if(err){
                if(err.code=11000){
                    res.status(401).send('USEREXISTS');
                } else{
                    res.status(500).send('ERROR');
                }      
            } else{
                console.log(docs);
                res.status(200).send("OK");
            }
        });  
    }
});

//HANDLING LOGIN
//INPUT EMAIL AND PASSWORD ONLY
//SEND AUTHORIZATION JWT IN RESPONSE TO BE INCLUDED IN SUBSEQUENT REQUESTS
app.options('/login',cors,function(req,res){
    res.send();
})
app.post('/login',cors,function(req,res){
    if(req.body.email==undefined || req.body.password==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        user.find({$and:[{email:{$eq:req.body.email}},{password:{$eq:SHA256(req.body.password)}}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send('ERROR');
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(404).send('REGISTER');
                }
                else{
                    jwt.sign({email:docs[0].email,timestamp:Date.now()},process.env.SECRET,function(err,token){
                        if(err){
                            console.log(err);
                            res.status(500).send('ERROR');
                        }
                        else{
                            res.header('Authorization',token);
                            console.log(token);
                            res.status(200).send({status:'OK',email:docs[0].email,name:docs[0].name});                           
                        }
                    });
                    
                }              
            }
        });
    }
});

//GETTING AVAILABLE USERS WITHOUT A TEAM
function getAvailableUsers(data){
    return new Promise(function(resolve){
        var send=[];
        for(var i=0;i<data.length;i++){
            send.push({email:data[i].email,name:data[i].name});
        }
        resolve(send);
        send=null;
    });
}
async function getAvailableUsers2(data){
    var result=await getAvailableUsers(data);
    return result;
}
app.options('/getavail',cors,authorization,function(req,res){
    res.send();
})
app.post('/getavail',cors,authorization,function(req,res){
    user.find({team:{$eq:null}},function(err,docs){
        if(err){
            console.log(err);
            res.status(500).send('ERROR');
        }
        else{
            getAvailableUsers2(docs).then(function(result){
                res.status(200).send({status:'OK'});
            }).catch(function(err){
                res.status(500).send();
            });
        }
    });
});


//SENDING INVITE TO A PERSON
app.options('/sendinvite',cors,authorization,function(req,res){
    res.send();
})
app.post('/sendinvite',cors,authorization,function(req,res){
    if(req.body.teamname==undefined || req.body.email==undefined || req.body.sendtoemail==undefined || req.body.sendtoname==undefined || req.body.sendtoname==undefined){
        console.log(req.body)
        res.status(400).send('Enter all details');
    }
    else{
        team.find({$and:[{name:req.body.teamname},{'member.name':{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send('ERROR');
            }
            else{
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('TEAMNOTEXISTORFILLED');
                }
                else{
                    user.update({$and:[{email:{$eq:req.body.sendtoemail}}]},{$push:{pending:{teamname:req.body.teamname,creater:{name:docs[0].creater.name,email:req.body.email}}}},{new: true},function(err,docs){
                        if(err){
                            res.status(500).send('ERROR')
                        }
                        else{
                            console.log(docs);
                            if(docs.n==0){
                                res.status(404).send('NOUSERORINTEAM');
                            }
                            else if(docs.nModified==0){
                                res.status(400).send('ERROR');
                            }
                            else {
                                user.update({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}}]},{$push:{invitesSent:{email:req.body.sendtoemail,name:req.body.sendtoname}}},{new: true},function(err,docs){
                                console.log(docs);
                                if(docs.n==0){
                                    res.status(404).send('NOUSERORINTEAM');
                                }
                                else if(docs.nModified==0){
                                    res.status(400).send('ERROR');
                                }
                                else {
                                    res.status(200).send("OK");
                                }
                                });
                            }
                        }      
                    });
                }
            }
        })
        
    }    
});


//CREATE A NEW TEAM
//REQUEST HAS TEAMNAME EMAIL
//400 INSUFF DETAILS/TRY AgAIN
//401 IN A TEAM/TEAM NME EXIST
//500 TRY AGAIN
//404 NO SUCH USER
//200 ADDED
app.options('/addteam',cors,authorization,function(req,res){
    res.send();
})
app.post('/addteam',cors,authorization,function(req,res){
    if(req.body.teamname==undefined || req.body.email==undefined){
        res.status(400).send('Enter all details');
    } else{
        //FINDING IF USER IS IN A TEAM
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}},{teamCreated:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err);
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(401).send('INTEAMORTEAMCREATED');
                }
                else{
                    //CREATING TEAMAND CHECKING FOR DUPLICATE
                    team.create({
                        name:req.body.teamname,
                        creater:{
                            name:docs[0].name,
                            email:req.body.email
                        },
                        member:{
                            name:null,
                            email:null
                        }
                    },function(err,docs){
                        if(err){
                            if(err.code=11000){
                                res.status(401).send('TEAMNAMEEXIST');
                            } else{
                                res.status(500).send('ERROR');
                            }      
                        } else{
                            //UPDATING USER TEAMCREATED
                            user.update({email:req.body.email},{$set:{teamCreated:req.body.teamname}},{new:true},function(err,docs){
                                if(docs.n==0){
                                    res.status(404).send('NOUSER');
                                }
                                else if(docs.nModified==0){
                                    res.status(400).send('ERROR');
                                }
                                else {
                                    res.status(200).send("OK");
                                }
                            });                            
                        }
                    });
                }
            }
        });     
    }
});



//TO VIEW PENDING INVITES
//HAS EMAIL AS BODY
//500 ERROR
//404 TEAM JOINED ALREaDY
//200 PENDING LIST
app.options('/pending',cors,authorization,function(req,res){
    res.send();
});
app.post('/pending',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('TEAMJOINED');
                } else{
                    res.status(200).send(docs[0].pending);
                }
            }
        });
    }
});

//DASHBOARD TO GET TEAM NAME IF ANY
//EMAIL AS INPUT
//500 INTERNAL ERROR
//404 NO USER
//200 TEAMNAME OR NULL
app.options('/dashboard',cors,authorization,function(req,res){
    res.send();
});
app.post('/dashboard',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        //FINDING USERS HAS TEAM OR NOT
        user.find({email:{$eq:req.body.email}},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('NOUSER');
                } else{
                    if(docs[0].team==null && docs[0].teamCreated==null){
                        res.status(200).send('NOTEAMS')
                    } 
                    //IF TEAM CREATED BUT ONLY MEMBER
                    else if(docs[0].teamCreated!=null){
                        res.status(200).send({
                            Code:"TEAMCREATED",
                            name:docs[0].teamCreated,
                            username:docs[0].name
                        });
                    }
                    else{
                        //FINDING USERS TEAM AND TEAM MATE
                        team.find({$or:[{"creater.email":{$eq:req.body.email}},{"member.email":{$eq:req.body.email}}]},function(err,docs){
                            if(err){
                                res.status(500).send('ERROR');
                            } else {
                                console.log(docs);
                                res.status(200).send({
                                    team:docs[0].name,
                                    creater:docs[0].creater,
                                    member:docs[0].member
                                })
                            }
                        });
                    }
                }
            }
        });
    }
});


//GET invitesSent

app.options('/sentinvite',cors,authorization,function(req,res){
    res.send();
});
app.post('/sentinvite',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        user.find({$and:[{email:{$eq:req.body.email}},{teamCreated:{$ne:null}},{team:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('TEAMJOINEDORNEVERCREATED');
                } else{
                    res.status(200).send(docs[0].invitesSent);
                }
            }
        });
    }
});

//FOR ACCEPTING INVITE FROM PENDING INVITES
//EMAIL TEAMNAME INPUT
//500 INTERNAL ERROR
//404 TEAM JOINED/TEAM FILLED/NO SUCH USER
//400 TRY AGAIN
//200 OK->DONE

app.options('/acceptinvite',cors,authorization,function(req,res){
    res.send();
});
app.post('/acceptinvite',cors,authorization,function(req,res){
    if(req.body.creatername==undefined || req.body.teamname==undefined || req.body.email==undefined){
        res.status(400).send('Enter all details')
    }
    else{
        //FINDING IF NOT IN A TEAM
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}},{pending:{$elemMatch:{teamname:req.body.teamname}}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(401).send('TEAMJOINED');
                } else{
                    //CHECKING AND UPDATINF IF TEAM FREE
                    team.update({$and:[{name:{$eq:req.body.teamname}},{"member.name":{$eq:null}}]},{$set:{member:{email:req.body.email,name:docs[0].name}}},{new:true},function(err,docs){
                        console.log(docs);
                        if(docs.n==0){
                            res.status(404).send('TEAMFILLEDORDELETED');
                        }
                        else if(docs.nModified==0){
                            res.status(400).send('ERROR');
                        }
                        else {
                            //UPDATING USER TEAM
                            user.findOneAndUpdate({email:req.body.email},{$set:{team:req.body.teamname,teamCreated:null,invitesSent:[]}},function(err,docs){
                                console.log(docs);
                                if(err){
                                    res.status(500).send("ERROR")
                                }
                                else if(docs==undefined){
                                    res.status(404).send('NOUSER');
                                }
                                else if(docs.team!=null){
                                    res.status(400).send('ERROR');
                                }
                                else {
                                    res.status(200).send("OK");
                                }
                                if(docs.teamCreated!=null){
                                    team.findOneAndRemove({name:docs.teamCreated},function(err,docs){
                                        if(err){
                                            console.log(err)
                                        } else {
                                            console.log(docs);
                                            if(docs.length==0){
                                                console.log('Not deleted');
                                            }
                                            else{
                                                console.log('Team deleted')
                                            }
                                        }
                                    });      
                                }
                                user.update({email:req.body.creatername},{$set:{team:req.body.teamname}},function(err,docs){
                                    if(err){
                                        console.log(err)
                                    }
                                    else if(docs.nModified==0){
                                        console.log(docs);
                                        console.log('ERROR CHECK WHY NOT TEAM MODIFYING')
                                    }
                                });

                                
                            });                        
                        }
                    })
                }
            }
        });
    }
});

//TO DELETE TEAM IF NO ONE ADDED AS MEMBER
//ONLY BY PEROSN WHO CREATED

app.options('/deleteteam',cors,authorization,function(req,res){
    res.send();
});
app.post('/deleteteam',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        //FIND IF TEAM HAS NO MEMBER ONLY CREATER THEN DELETE TEAM
        team.findOneAndRemove({$and:[{"creater.email":{$eq:req.body.email}},{"member.name":{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs==null){
                    res.status(401).send('TEAMFILLED');
                }
                else{
                    //UPDATE USERS WHOSE TEAM  HAD BEEN TO NULL BACK AGAIN
                    user.update({email:req.body.email},{$set:{teamCreated:null,invitesSent:[]}},{new:true},function(err,docs){
                        if(docs.n==0){
                            res.status(404).send('NOUSER');
                        }
                        else if(docs.nModified==0){
                            res.status(400).send('ERROR');
                        }
                        else {
                            res.status(200).send("OK");
                        }
                    });  
                }
            }
        });
    }
});



app.use('*',function(req,res){
    res.status(404).send('Not found');
});



app.listen(process.env.PORT || 3000);