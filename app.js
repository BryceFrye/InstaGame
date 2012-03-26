$(function(){

  window.Photo = Backbone.Model.extend({
  });
  
  window.User = Backbone.Model.extend({
    initialize: function() {
      this.token = window.location.hash.slice(1,99);  
    },
    url: function() {
      return 'https://api.instagram.com/v1/users/self?'+this.token+'&callback=?';
    },
    parse: function(response) {
      return response.data;
    }
  });
  
  window.PhotoFeed = Backbone.Collection.extend({
    model: Photo,
    
    initialize: function() {
      this.token = window.location.hash.slice(1,99);
    },
    url: function() {
      return 'https://api.instagram.com/v1/users/self/feed?'+this.token+'&callback=?&count=30';
    },
    parse: function(response) {
      return response.data;
    }
  });
  
  window.UserPhotos = Backbone.Collection.extend({
    model: Photo,
    
    initialize: function() {
      this.token = window.location.hash.slice(1,99);
    },
    url: function() {
      return 'https://api.instagram.com/v1/users/self/follows?'+this.token+'&callback=?';
    },
    parse: function(response) {
      return response.data;
    }  
  });
  
  window.ExpertPhotoFeed = Backbone.Collection.extend({
    model: Photo,
    
    initialize: function() {
      this.token = window.location.hash.slice(1,99);
    },
    url: function() {
      return 'https://api.instagram.com/v1/media/popular?'+this.token+'&callback=?';
    },
    parse: function(response) {
      return response.data;
    }
  });
  
  window.PhotoView = Backbone.View.extend({
    tagName: "li",
    template: _.template($('#photo-template').html()),
       
    initialize: function() {
      _.bindAll(this, 'render');
      this.render();
    },
    render: function() {
      $(this.el).html(this.template({ model: this.model }));
      return this;
    }
  });
  
  window.UserView = Backbone.View.extend({
    tagName: "span",
    template: _.template($('#user-template').html()),
    currentPhotoIndex: 0,
    
    events: {
      "click .user-photo" : "guess"
    },       
    initialize: function() {
      _.bindAll(this, 'render');
      this.render();
    },
    render: function() {
      $(this.el).html(this.template({ model: this.model }));
      return this;
    },
    guess: function() {
      if ( this.model.get('user') == null) {
        window.App.trigger("guessedUser", this.model.get('username'), this.$(".user-photo"));
      } else {
        window.App.trigger("guessedUser", this.model.get('user').username, this.$(".user-photo"));
      }
    }
  });
  
  window.GameView = Backbone.View.extend({
    el: "#controls",
    loginTemplate: _.template($('#login-template').html()),
    playTemplate: _.template($('#play-template').html()),
    instructionsTemplate: _.template($('#instructions-template').html()),
    photoErrorTemplate: _.template($('#photo-error-template').html()),
    followErrorTemplate: _.template($('#follow-error-template').html()),
    scoreTemplate: _.template($('#score-template').html()),
    currentPhoto: 0,
    score: 0,
    
    events: {
      "click #easy": "easy",
      "click #hard" : "hard",
      "click #expert" : "expert"
    },

    initialize: function() {
      _.bindAll(this, 'render');
      this.bind("guessedUser", this.guessedUser);
      this.render();
    },   
    render: function() {
      if (window.location.hash.length == 0) {
         $(this.el).append(this.loginTemplate());
      } else {
         $(this.el).append(this.playTemplate());
      }
      $("#instructions-area").append(this.instructionsTemplate());
      return this;
    },
    easy: function() {
      this.difficulty = 3;
      this.startGame();
    },
    hard: function() {
      this.difficulty = 5;
      this.startGame();
    },
    expert: function() {
      this.difficulty = 4;
      this.startGame();
    },
    startGame: function() {
      var self = this;
      $("#difficulty").hide();
      $("#score").remove();
      $("#instructions").fadeOut('fast');
      $("#instructions-area").fadeOut('fast',function() {
        self.getUser();
      });
    },
    getUser: function() {
      var self = this;
      this.user = new User();
      this.user.fetch({success: function(model, response){
        self.getPhotos();
      }});
    },
    getPhotos: function() {
      var self = this;
      this.score = 0;
      if ( this.difficulty == 4 ) {
        this.photoCollection = new ExpertPhotoFeed();
      } else {
        this.photoCollection = new PhotoFeed();
      }
      this.photoCollection.fetch({success: function(photos, response) {
        photos.models.sort(self.randomize);
        photos.models.forEach(function(photo){
          if ( photo.get('user').username == self.user.get('username') ) {
            photo.destroy();
          } else {
            var row = new PhotoView({ model: photo });
            $("#photos").append(row.el);
          }
        });
        if ( photos.models.length > 9 ) {
          $("#controls").slideUp('fast');
          $(".photo").hide();
          $(".photo:first").addClass("active").fadeIn('fast');
          if ( self.difficulty == 4 ) {
            self.getExpertUsers();
          } else {
            self.getUsers();
          }
        } else {
          self.notEnoughPhotos();
        }
      }});
    },
    notEnoughPhotos: function() {
      $("#photos li").remove();
      $("#instructions-area").fadeIn('fast');
      $("#instructions-area").append(this.photoErrorTemplate());
    },
    notFollowingEnough: function() {
      $("#photos li").remove();
      $("#user-photos span").remove();
      $("#instructions-area").fadeIn('fast');
      $("#instructions-area").append(this.followErrorTemplate());
    },
    randomize: function() {
      return (Math.round(Math.random())-0.5);
    },
    getUsers: function() {
      var self = this;
      this.userCollection = new UserPhotos();
      this.userCollection.fetch({success: function(userPhotos, response) {
        if ( userPhotos.length > 4 ) {
          self.findUserPhoto();
        } else {
          self.notFollowingEnough();
        }
      }});
    },
    getExpertUsers: function() {
      var self = this;
      this.userCollection = new Array();
      this.photoCollection.models.forEach(function(photo){
        self.userCollection.push(photo);
      });
      this.findUserPhoto();
    },
    findUserPhoto: function() {
      var self = this;
      if ( this.difficulty == 4 ) {
        var userCollectionCopy = _.clone(this.userCollection);
      } else {
        var userCollectionCopy = _.clone(this.userCollection.models);
      }
      userArray = new Array();
      userCollectionCopy.forEach(function(user){
        var username = user.get('username') || user.get('user').username;
        if ( username == self.photoCollection.models[self.currentPhoto].get('user').username ) {
          userArray.push(user);
          userCollectionCopy = _.without(userCollectionCopy, user);
        }
      });
      while ( userArray.length < this.difficulty ) {
        var randomNumber = Math.floor(Math.random() * userCollectionCopy.length);
        userArray.push(userCollectionCopy[randomNumber]);
        userCollectionCopy = _.without(userCollectionCopy, userCollectionCopy[randomNumber]);
      }
      userArray.sort(this.randomize);
      userArray.forEach(function(photo) {
        var userPhoto = new UserView({ model: photo, difficulty: self.difficulty, photoCollection: self.photoCollection });
        $("#user-photos").append(userPhoto.el);
      });
      if ( this.currentPhoto > 9) {
        $("#photos li").remove();
        $("#user-photos span").remove();
        $("#controls").slideDown('fast');
        $("#difficulty").show();
        $("#instructions-area").fadeIn("slow");
        if ( this.difficulty == 4 ) {
          this.difficulty = 7;
        }
        $("#instructions-area").append(this.scoreTemplate({ score: this.score, total: this.difficulty }));
        this.currentPhoto = 0;
      }
    },
    guessedUser: function(username, photo) {
      var self = this;
      var photoUsername = this.photoCollection.models[this.currentPhoto].get('user').username;
      if ( username  == photoUsername ) {
        this.currentPhoto = this.currentPhoto + 1;
        if ( this.difficulty == 3 ) {
          self.score = self.score + 20;
        } else if ( this.difficulty == 5 ) {
          self.score = self.score + 40;
        } else if ( this.difficulty == 4 ) {
          self.score = self.score + 60;
        }
        $("#guess-correct").fadeIn(100);
        $("#guess-correct").fadeOut(400, function() {
          $(".active").remove();
          $("#user-photos span").remove();
          $(".photo:first").addClass("active").fadeIn('fast');
          self.findUserPhoto();
          console.log("Score: "+self.score);
        });
      } else {
        if ( this.difficulty == 4 ) {
          this.score = this.score - 20;
        } else {
          this.score = this.score - 10;
        }
        $("#guess-wrong").fadeIn(100);
        $("#guess-wrong").fadeOut(400);
        photo.css({"text-decoration" : "line-through", "opacity" : ".3"});
        console.log("Score: "+self.score);
      }
    }
  });
  
  window.App = new GameView;
  
});