//IMPORTS
const express=require('express');
const jwt=require('jsonwebtoken');
const bodyParser=require('body-parser');
const SHA256 = require("crypto-js/sha256");
const cookieParser = require('cookie-parser')
 
const mongoose = require('mongoose');

//SETTING CONFIG
require('dotenv').config();


var app = express()
app.use(cookieParser())
app.use(bodyParser.json({ type: 'application/json' }))

//MONGOOSE SETUP
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

//EXPRESS MIDDLEWARE FOR CORS
function cors(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Methods','*');
    res.setHeader('Access-Control-Expose-Headers','Authorization, Content-Length');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Origin, Accept,Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
    next();
};

//CHECK HEADER
function authorization(req,res,next){
    if(req.get('Authorization')==undefined){
        console.log('NO HEADER');
        res.status(401).send({code:"UNAUTHORISED"});
    }
    else{
        jwt.verify(req.get('Authorization'),process.env.SECRET, function(err, decoded) {
            if(err){
                console.log(err);
                res.status(401).send({code:"UNAUTHORISED"});
            } else {
                res.header('Authorization',req.get('Authorization'));
                req.body.email=decoded.email;
                req.body.name=decoded.name;
                console.log(req.body.email)
                next();
            }    
        });
    }    
}

//MAIN
app.get('/',function(req,res){
    res.send('WORKING')
})

//SIGNUP
app.options('/signup',cors,function(req,res){
    res.send();
})
app.post('/signup',cors,function(req,res){
    if(req.body.email==undefined || req.body.phone==undefined || req.body.name==undefined || req.body.regno==undefined || req.body.password==undefined){
        console.log(req.body)
        res.status(404).send({code:'Enter all details'})
    } else{
        user.create({
            email:req.body.email,name:req.body.name,phone:req.body.phone,regno:req.body.regno,password:SHA256(req.body.password),team:null
        },function(err,docs){
            if(err){
                if(err.code=11000){
                    res.status(401).send({code:'USEREXISTS'});
                } else{
                    res.status(500).send({code:'ERROR'});
                }      
            } else{
                console.log(docs);
                jwt.sign({email:docs.email,name:docs.name,regno:req.body.regno,timestamp:Date.now()},process.env.SECRET,function(err,token){
                    if(err){
                        console.log(err);
                        res.status(500).send({code:'ERROR'});
                    }
                    else{
                        res.header('Authorization',token);
                        console.log(token);
                        res.status(200).send({code:'OK',email:docs.email,name:docs.name});                           
                    }
                });
            }
        });  
    }
});

//LOGIN
app.options('/login',cors,function(req,res){
    res.send();
})
app.post('/login',cors,function(req,res){
    if(req.body.email==undefined || req.body.password==undefined){
        res.status(400).send({code:'Enter all details'});
    }
    else{
        user.find({$and:[{email:{$eq:req.body.email}},{password:{$eq:SHA256(req.body.password)}}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send({code:'ERROR'});
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(404).send({code:'NOTFOUND'});
                }
                else{
                    console.log(docs);
                    jwt.sign({email:docs[0].email,name:docs[0].name,regno:docs[0].regno,timestamp:Date.now()},process.env.SECRET,function(err,token){
                        if(err){
                            console.log(err);
                            res.status(500).send({code:'ERROR'});
                        }
                        else{
                            res.header('Authorization',token);
                            console.log(token);
                            res.status(200).send({code:'OK',email:docs[0].email,name:docs[0].name});                           
                        }
                    });
                }           
            }
        });
    }
});

function getAvailableUsers(data,data1){
    return new Promise(function(resolve){
        var x=null;
        for(var i=0;i<data.length;i++){
            if(data[i].email==data1){
                x=data[i].invitesSent;
            }           
        }
        var send=[];
        for(var i=0;i<data.length;i++){
            if(x!=null){
                if(x.length>0){
                    var ok=0;
                    for(var j=0;j<x.length;j++){
                        
                        if(data[i].email!=x[j].email){
                            ok++;
                        }    
                    }
                    if(ok==x.length && data[i].email!=data1){
                        send.push({email:data[i].email,name:data[i].name});
                    }
                }
                else{
                    if(data[i].email!=data1)
                    {send.push({email:data[i].email,name:data[i].name});}
                }
            }
            else{
                if(data[i].email!=data1)
                    {send.push({email:data[i].email,name:data[i].name});}
            }
                       
        }
        console.log(send);
        resolve(send);
        send=null;
        x=null
    });
}
async function getAvailableUsers2(data,data1){
    var result=await getAvailableUsers(data,data1);
    return result;
}

//GET AVAILABLE
app.options('/getavail',cors,function(req,res){
    res.send();
})
app.post('/getavail',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        user.find({email:{$eq:req.body.email}},function(err,docs1){
        if(err){
            console.log(err)
            res.status(500).send({code:'ERROR'});
        } else {
            if(docs1.length==0 || docs1==null){
                res.status(404).send({code:'NOTFOUND'});
            } else{
                user.find({team:{$eq:null}},function(err,docs){
                    if(err){
                        console.log(err);
                        res.status(500).send({code:'ERROR'});
                    }
                    else{
                        getAvailableUsers2(docs,req.body.email).then(function(result){
                            res.status(200).send({code:"OK",result:result});
                        }).catch(function(err){
                            console.log(err);
                            res.status(500).send({code:"ERROR"});
                        });
                    }
                });
                
            }
        }
    });
    }
});

//DASHBOARD
app.options('/dashboard',cors,function(req,res){
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
                res.status(500).send({code:'ERROR'});
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send({code:'NOTFOUND'});
                } else{
                    if(docs[0].team==null && docs[0].teamCreated==null){
                        res.status(200).send({code:'NOTEAMS',name:docs[0].name})
                    } 
                    //IF TEAM CREATED BUT ONLY MEMBER
                    else if(docs[0].teamCreated!=null && docs[0].team==null){
                        res.status(200).send({
                            code:"TEAMCREATED",
                            teamname:docs[0].teamCreated,
                            name:docs[0].name
                        });
                    }
                    else if(team!=null){
                        //FINDING USERS TEAM AND TEAM MATE
                        team.find({$or:[{"creater.email":req.body.email},{"member.email":req.body.email}]},function(err,docs){
                            if(err){
                                res.status(500).send({code:'ERROR'});
                            } else {
                                console.log(docs);
                                if(docs.length==0){
                                    res.status(500).send();
                                }
                                else{
                                res.status(200).send({
                                    code:"TEAMJOINED",
                                    team:docs[0].name,
                                    creater:docs[0].creater,
                                    member:docs[0].member
                                })}
                            }
                        });
                    }
                    else{
                        res.status(500).send();
                    }
                }
            }
        });
    }
});

//ADD TEAM
app.options('/addteam',cors,function(req,res){
    res.send();
})
app.post('/addteam',cors,authorization,function(req,res){
    if(req.body.teamname==undefined || req.body.email==undefined){
        res.status(400).send({code:'ENTERALL'});
    } else{
        //FINDING IF USER IS IN A TEAM
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}},{teamCreated:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send("ERROR");
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(200).send({code:'INATEAMORTEAMCREATED'});
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
                                res.status(200).send({code:'TEAMNAMEEXIST'});
                            } else{
                                res.status(500).send({code:'ERROR'});
                            }      
                        } else{
                            //UPDATING USER TEAMCREATED
                            user.findOneAndUpdate({email:req.body.email},{$set:{teamCreated:req.body.teamname}},{new:true},function(err,docs){
                                if(err || docs==undefined){
                                    res.status(500).send({code:"ERROR"});
                                }
                                else {
                                    res.status(200).send({code:"OK"});
                                }
                            });                            
                        }
                    });
                }
            }
        });     
    }
});


//DELETE TEAM

app.options('/deleteteam',cors,function(req,res){
    res.send();
});
app.post('/deleteteam',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send({code:'ENTERALL'});
    }
    else{
        //FIND IF TEAM HAS NO MEMBER ONLY CREATER THEN DELETE TEAM
        team.findOneAndRemove({$and:[{"creater.email":{$eq:req.body.email}},{"member.name":{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send({code:'ERROR'});
            } else {
                console.log(docs);
                if(docs==null){
                    res.status(401).send({code:'TEAMFILLEDORNOTMADE'});
                }
                else{
                    //UPDATE USERS WHOSE TEAM  HAD BEEN TO NULL BACK AGAIN
                    user.update({email:req.body.email},{$set:{teamCreated:null,invitesSent:[]}},{new:true},function(err,docs){
                        if(docs.n==0){
                            res.status(404).send({code:'NOUSER'});
                        }
                        else if(docs.nModified==0){
                            res.status(500).send({code:'ERROR'});
                        }
                        else {
                            res.status(200).send({code:"OK"});
                        }
                    });  
                }
            }
        });
    }
});

//GET INVITES AND PENDIND
app.options('/pending',cors,function(req,res){
    res.send();
});
app.post('/pending',cors,authorization,function(req,res){
    if(req.body.email==undefined){
        res.status(400).send({code:'ENTERALL'});
    }
    else{
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('ERROR');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(200).send({
                        code:'TEAMJOINED'
                    });
                } else{
                    res.status(200).send({
                        status:"OK",
                        pending:docs[0].pending,
                        sent:docs[0].invitesSent
                    });
                }
            }
        });
    }
});

//SENDINVITE
app.options('/sendinvite',cors,function(req,res){
    res.send();
})
app.post('/sendinvite',cors,authorization,function(req,res){
    if(req.body.email==undefined || req.body.sendtoemail==undefined || req.body.sendtoemail==req.body.email){
        res.status(400).send({code:'ENTERALLORSAMEEMAIL'});
    }
    else{
        team.findOne({$and:[{'creater.email':{$eq:req.body.email}},{'member.email':{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send({code:'ERROR'});
            }
            else{
                console.log(docs);
                if(docs==undefined){
                    res.status(404).send({code:'TEAMNOTEXISTORFILLED'});
                }
                else{
                    user.findOneAndUpdate({email:{$eq:req.body.sendtoemail}},{$push:{pending:{teamname:docs.name,creater:{name:docs.creater.name,email:docs.creater.email}}}},{new: true},function(err,docs){
                        if(err){
                            res.status(500).send({code:'ERROR'})
                        }
                        else{
                            console.log(docs);
                            if(docs==undefined){
                                res.status(404).send({code:'NOUSERORINTEAM'});
                            }
                            else {
                                user.findOneAndUpdate({email:{$eq:req.body.email}},{$push:{invitesSent:{email:docs.email,name:docs.name}}},{new: true},function(err,docs){
                                console.log(docs);
                                if(err){
                                    res.status(500).send({code:'ERROR'});
                                }
                                else {
                                    res.status(200).send({code:"OK",invites:docs.invitesSent});
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


//ACCEPT INVITATION

app.options('/acceptinvite',cors,function(req,res){
    res.send();
});
app.post('/acceptinvite',cors,authorization,function(req,res){
    if(req.body.teamname==undefined || req.body.email==undefined){
        res.status(400).send({code:'ENTERALL'});
    }
    else{
        //FINDING IF NOT IN A TEAM
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}},{pending:{$elemMatch:{teamname:req.body.teamname}}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send({code:'ERROR'});
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(200).send({code:'TEAMJOINED'});
                } else{
                    //CHECKING AND UPDATINF IF TEAM FREE
                    team.update({$and:[{name:{$eq:req.body.teamname}},{"member.name":{$eq:null}}]},{$set:{member:{email:docs[0].email,name:docs[0].name}}},{new:true},function(err,docs){
                        console.log(docs);
                        if(docs.n==0){
                            res.status(200).send({code:'TEAMFILLEDORDELETED'});
                        }
                        else if(docs.nModified==0){
                            res.status(500).send({code:'ERROR'});
                        }
                        else {
                            //UPDATING USER TEAM
                            user.findOneAndUpdate({email:req.body.email},{$set:{team:req.body.teamname,teamCreated:null,invitesSent:[],pending:[]}},function(err,docs){
                                console.log(docs);
                                if(err){
                                    res.status(500).send({code:"ERROR"})
                                }
                                else if(docs==undefined){
                                    res.status(404).send({code:'NOUSER'});
                                }
                                else if(docs.team!=null){
                                    res.status(500).send({code:'ERROR'});
                                }
                                else {
                                    user.findOneAndUpdate({teamCreated:req.body.teamname},{$set:{team:req.body.teamname}},function(err,docs){
                                                if(err){
                                                    console.log(err);
                                                    res.status(500).send({code:"ERROR"})
                                                }
                                                else{
                                                    res.status(200).send({code:"OK"});
                                        
                                                }
                                            });

                                        }
                                    
                                
                            });                        
                        }
                    })
                }
            }
        });
    }
});


//REJECT INVITATION
app.options('/rejectinvite',cors,function(req,res){
    res.send();
});
app.post('/rejectinvite',cors,authorization,function(req,res){
    if(req.body.teamname==undefined || req.body.email==undefined){
        res.status(400).send({code:'ENTERALL'});
    }
    else{
        user.findOneAndUpdate({email:{$eq:req.body.email}},{$pull:{pending:{teamname:req.body.teamname}}},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send({code:"ERROR"});
            } else if(docs==undefined){
                console.log(docs);
                res.status(500).send({code:"ERROR"});
            } else{
                var x=null;
                for(var i=0;i<docs.pending.length;i++){
                    if(docs.pending[i].teamname==req.body.teamname){
                        x=docs.pending[i].creater.email;
                    }
                }
                user.findOneAndUpdate({email:{$eq:x}},{$pull:{invitesSent:{email:req.body.email}}},function(err,docs){
                if(err){
                    res.status(500).send({code:"ERROR"})
                }
                else{
                    res.status(200).send({
                        code:"OK"
                    })
                }
            });
                    
            }
        });
    }
});
app.post('/cancelinvite',function(req,res){
    if(req.body.email==undefined || req.body.sendtoemail==undefined){
        res.status(400).send({code:'ENTERALL'});
    }
    else{
        user.findOneAndUpdate({email:{$eq:req.body.email}},{$pull:{invitesSent:{email:req.body.sendtoemail}}},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send({code:"ERROR"});
            } else if(docs==undefined){
                console.log(docs);
                console.log(1);
                res.status(500).send({code:"ERROR"});
            } else{
                console.log('SEconds')
                user.update({email:{$eq:req.body.sendoemail}},{$pull:{pending:{creater:{email:req.body.email}}}},function(err,docs){
                    if(err){
                         
                        console.log(err);
                        res.status(500).send({code:"ERROR"});
                    } else if(docs==undefined){
                        console.log(0);
                        console.log(docs);
                        res.status(500).send({code:"ERROR"});
                    } else{
                        res.status(200).send({code:"OK"});
                    }
                });
            }
        });
    }
})
//DEFAULT
app.use('*',function(req,res){
    res.status(404).send('Not found');
});


app.listen(process.env.PORT || 3000);