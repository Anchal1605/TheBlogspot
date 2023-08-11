require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const _ = require('lodash');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");


const app = express();

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

//.........setting up session
app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

//....initalise passport
app.use(passport.initialize());

//....use passport
app.use(passport.session());


mongoose.set('strictQuery', false);
mongoose.connect(process.env.MONGO_URI);

// mongoose.set("useCreateIndex", true);

const postSchema = {
  title: String,
  content: String,
  name:String,
  email:String,
  authorId:String,
  likes: Number,
  timestamp: String
};

const Post = mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
  name:String,
  email: String,
  password: String,
  posts:[postSchema],
  likedPosts:[String]
});


//add plugin before creating model
userSchema.plugin(passportLocalMongoose);


const User = new mongoose.model("User", userSchema);


passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {

  Post.find((err, posts) => {
    posts.sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    if (req.isAuthenticated()) {
      User.findById(req.user.id, (err, foundUser) => {
        if (err) {
          console.log(err);
          res.send("There was an error. Please try again.");
        } else {
          res.render("home", {
            newPost: posts,
            authenticated: req.isAuthenticated(),
            userLikedPosts: foundUser.likedPosts,
          });
        }
      });
    } else {
      res.render("home", {
        newPost: posts,
        authenticated:req.isAuthenticated(),
        userLikedPosts: null,
      });
    }
  });
  });



app.get("/register", (req, res) => {
  res.render("register",{ authenticated: req.isAuthenticated() });
});

app.get("/login", (req, res) => {
  res.render("login",{ authenticated: req.isAuthenticated() });
});




app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username ,name:req.body.name}, req.body.password, (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/");
        });
      }
    }
  );
});

app.post("/login", (req, res) => {

  const user = new User({
    username: req.body.username,
    password: req.body.password
  })

  req.login(user, (err)=> {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      })
    }
  })
});


app.get("/logout",(req,res)=>{
  req.logout(function(err) {
    if (err) { return next(err); }  
  });
  res.redirect("/");
});

app.get("/about", (req, res) => {
  res.render("about", {
     authenticated: req.isAuthenticated()
  });
});

app.get("/contact", (req, res) => {
  res.render("contact", { 
    authenticated: req.isAuthenticated() });
});

app.get("/compose", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("compose", { authenticated: req.isAuthenticated() });
  } else {
    res.redirect("/login",);
  }
})

app.post("/compose", (req, res) => {

  User.findById(req.user.id, (err, foundUser) => {
    if (err) {
      console.log(err);
      res.send("Please log in to post.");
    } else {
      
      const today = new Date();
      const dateTime =
      today.getFullYear() +
      "-" +
      (today.getMonth() + 1) +
      "-" +
      today.getDate() +
      " " +
      today.getHours() +
      ":" +
      today.getMinutes() +
      ":" +
      today.getSeconds();

      const post = new Post({
        title: req.body.postTitle,
        content: req.body.postContent,
        name:foundUser.name,
        email: foundUser.username,
        authorId: req.user.id,
        likes: 0,
        timestamp: dateTime
      });

      post.save();

      foundUser.posts.push(post);

      foundUser.save(() => {
        res.redirect("/");
      });
    }
  });

});

app.post("/like", (req, res) => {
  const liked = req.body.liked;
  const postId = req.body.postId;

  if (req.isAuthenticated()) {
    User.findById(req.user.id, (err, foundUser) => {
      if (err) {
        console.log(err);
        res.send("There was an error. Please try again.");
      } else {
        if (liked === "true") {
          foundUser.likedPosts.push(postId);
          foundUser.save();
          Post.findById(postId, (err, foundPost) => {
            if (err) {
              console.log(err);
              res.send("There was an error");
            } else {
              foundPost.likes++;
              foundPost.save();
            }
          });
          res.redirect("/");
        } else {
          foundUser.likedPosts.splice(foundUser.likedPosts.indexOf(postId), 1);
          foundUser.save();
          Post.findById(postId, (err, foundPost) => {
            if (err) {
              console.log(err);
              res.send("There was an error");
            } else {
              foundPost.likes--;
              foundPost.save();
            }
          });
          res.redirect("/");
        }
      }
    });
  }
});

app.get("/posts/:postId", (req, res) => {

  const requestedId = req.params.postId;
  Post.findOne({ _id: requestedId }, function (err, post) {
    if (post) {
      res.render("post", {
        authenticated: req.isAuthenticated(),
        title: post.title,
        content: post.content,
        name: post.name,
        
      })
    }

  });
});










app.listen(3000, function () {
  console.log("Server started on port 3000");
});
