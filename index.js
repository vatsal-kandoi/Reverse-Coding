const express=require('express');
const jwt=require('jsonwebtoken');
const bodyParser=require('body-parser');
const SHA256 = require("crypto-js/sha256");

const mongoose = require('mongoose');

require('dotenv').config();

mongoose.connect(process.env.URL);

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
    regno:{
        type:String,
        unique:true,
        required:true
    },
    password:{
        type:String,
        required:true
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
            type:String,
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
    creater:{
        type:String,
    },
    member:{
        type:String
    }
});
var team=mongoose.model('team',teamSchema);

//SETUP APP
var app=express();
app.use(bodyParser.json({ type: 'application/json' }))

//EXPRESS MIDDLEWARE FOR CORS
function cors(req,res,next){
    res.setHeader('Access-Control-Allow-Origin','*');
    res.setHeader('Access-Control-Allow-Credentials','true');
    res.setHeader('Access-Control-Allow-Methods','*');
    res.setHeader('Access-Control-Allow-Headers','Authorization,Origin, Accept,Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
    next();
};

//EXPRESS MIDDLEWRE FOR AUTHORIZATION
function authorization(req,res,next){
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
                next();
            }
        }    
    });
}

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
                    res.status(401).send('Duplicate');
                } else{
                    res.status(500).send('Try again');
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
                res.status(500).send('Error');
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(404).send('Not present');
                }
                else{
                    jwt.sign({email:docs[0].email,timestamp:Date.now()},process.env.SECRET,function(err,token){
                        if(err){
                            res.status(500).send('Try again');
                        }
                        else{
                            res.header('Authorization',token);
                            console.log(token);
                            res.status(200).send('OK');                           
                        }
                    });
                    
                }              
            }
        });
    }
});


//GETTING AVAILABLE USERS
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
            res.status(500).send('Error');
        }
        else{
            var result=getAvailableUsers2(docs);
            res.send(result);
            result=null;
        }
    });
});


//SENDING INVITE TO A PERSON
app.options('/sendinvite',cors,authorization,function(req,res){
    res.send();
})
app.post('/sendinvite',cors,authorization,function(req,res){
    if(req.body.teamname==undefined||req.body.email==undefined||req.body.email==undefined){
        res.status(400).send('Enter all details');
    }
    else{
        team.find({$and:[{creater:{$eq:req.body.email}},{name:req.body.teamname}]},function(err,docs){
            if(err){
                console.log(err);
                res.status(500).send('Try again');
            }
            else{
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('No such team');
                }
                else{
                    user.update({$and:[{email:{$eq:req.body.sendtoemail}},{team:{$eq:null}}]},{$push:{pending:{teamname:req.body.teamname,creater:req.body.email}}},{new: true},function(err,docs){
                        if(err){
                            res.status(500).send('Try again')
                        }
                        else{
                            console.log(docs);
                            if(docs.n==0){
                                res.status(404).send('No such user');
                            }
                            else if(docs.nModified==0){
                                res.status(400).send('Try again');
                            }
                            else {
                                res.status(200).send('Invite sent')
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
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err);
            }
            else{
                console.log(docs)
                if(docs.length==0){
                    res.status(401).send('Already in a team');
                }
                else{
                    //CREATING TEAMAND CHECKING FOR DUPLICATE
                    team.create({
                        name:req.body.teamname,
                        creater:req.body.email,
                        member:null
                    },function(err,docs){
                        if(err){
                            if(err.code=11000){
                                res.status(401).send('Duplicate team name');
                            } else{
                                res.status(500).send('Try again');
                            }      
                        } else{
                            //UPDATING USER TEAMNAME
                            user.update({email:req.body.email},{$set:{team:req.body.teamname}},{new:true},function(err,docs){
                                if(docs.n==0){
                                    res.status(404).send('No such user');
                                }
                                else if(docs.nModified==0){
                                    res.status(400).send('Try again');
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
                res.status(500).send('Error');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('You must have joined a team already');
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
        user.find({email:{$eq:req.body.email}},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('Error');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('No such user');
                } else{
                    res.status(200).send(docs[0].team);
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
    if(req.body.teamname==undefined || req.body.email==undefined){
        res.staus(400).send('Enter all details')
    }
    else{
        //FINDING IF NOT IN A TEAM
        user.find({$and:[{email:{$eq:req.body.email}},{team:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('Error');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(404).send('You must have joined a team already');
                } else{
                    //CHECKING AND UPDATINF IF TEAM FREE
                    team.update({$and:[{name:{$eq:req.body.teamname}},{member:{$eq:null}}]},{$set:{member:req.body.email}},{new:true},function(err,docs){
                        if(docs.n==0){
                            res.status(404).send('Team filled');
                        }
                        else if(docs.nModified==0){
                            res.status(400).send('Try again');
                        }
                        else {
                            //UPDATING USER TEAM
                            user.update({email:req.body.email},{$set:{team:req.body.teamname}},{new:true},function(err,docs){
                                if(docs.n==0){
                                    res.status(404).send('No such user');
                                }
                                else if(docs.nModified==0){
                                    res.status(400).send('Try again');
                                }
                                else {
                                    res.status(200).send("OK");
                                }
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
        team.findOneAndRemove({$and:[{creater:{$eq:req.body.email}},{member:{$eq:null}}]},function(err,docs){
            if(err){
                console.log(err)
                res.status(500).send('Error');
            } else {
                console.log(docs);
                if(docs.length==0){
                    res.status(401).send('Someone must have joined your team already');
                } else{
                    user.update({email:req.body.email},{$set:{team:null}},{new:true},function(err,docs){
                        if(docs.n==0){
                            res.status(404).send('No such user');
                        }
                        else if(docs.nModified==0){
                            res.status(400).send('Try again');
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



app.listen(3000);