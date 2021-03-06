var _ = require('lodash')
	, express = require('express')
	, cookieParser = require('cookie-parser')
	, session = require('express-session')
	, passport = require('./auth')
	, app = express()
	, fixtures = require('./fixtures')
	, bodyParser = require('body-parser')
	, shortId = require('shortid')
  , config = require('./config')
  , conn = require('./db')
  , User = conn.model('User')

// Authentication
app.use(bodyParser.json())
app.use(cookieParser())

app.use(session({
	secret: 'keyboard cat',
	resave: false,
	saveUninitialized: true
}))

app.use(passport.initialize())
app.use(passport.session())

// Routes
app.get('/api/tweets', function (req, res) {
	if (!req.query.userId) {
		return res.sendStatus(400)
	}

	var tweets = _.where(fixtures.tweets, { userId: req.query.userId})
	var sortedTweets = tweets.sort(function (a,b) {return b.created - a.created })

	res.send({ tweets: sortedTweets })
})

app.get('/api/users/:userId', function (req, res) {
  var user = _.find(fixtures.users, 'id', req.params.userId)

  if (!user) {
	  return res.sendStatus(404)
  }

  res.send({ user: user })
})

app.post('/api/users', function (req, res) {
  var user = new User(req.body.user)

  user.save(function (err) {
    if (err) {
      if (err.code === 11000) return res.sendStatus(409)
    }
    
    req.login(user, function (err) {
    if (err) {
      return res.sendStatus(500)
    }
    res.sendStatus(200)
    })
  })
})

app.post('/api/tweets', ensureAuthentication, function (req, res) {
	var tweet = req.body.tweet

	tweet.id = shortId.generate()
	tweet.created = Date.now() / 1000 | 0

	// overwrite the userId field with the authenticated user id
	tweet.userId = req.user.id
	
	fixtures.tweets.push(tweet)

	res.send({ tweet: tweet })
})

app.get('/api/tweets/:tweetId', function (req, res) {
	var tweet = _.find(fixtures.tweets, 'id', req.params.tweetId)

	if (!tweet) {
	  return res.sendStatus(404)
	}

	res.send({ tweet: tweet })
})


// Authentication route
app.post('/api/auth/login', function (req, res) {
  passport.authenticate('local', function (err, user, info) {
    if (err) {
      return res.sendStatus(500)
    }
    if (!user) {
      return res.sendStatus(403)
    }
    req.login(user, function(err) {
      if (err) {
        return res.sendStatus(500)
      }
      return res.send({ user: user })
    })
  })(req, res)
})

app.post('/api/auth/logout', function (req, res) {
	req.logout()
	res.sendStatus(200)
})

// middleware implementation
function ensureAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.sendStatus(403)
}

// load middleware at route level
app.delete('/api/tweets/:tweetId', ensureAuthentication, function(req, res) {
  var tweet = _.find(fixtures.tweets, 'id', req.params.tweetId)

  if (!tweet) {
  	return res.sendStatus(404)
  }

  if (tweet.userId !== req.user.id) {
    return res.sendStatus(403)
  }

  _.remove(fixtures.tweets, 'id', req.params.tweetId)
  
  res.sendStatus(200)
})

// Export server
var server = app.listen(config.get('server:port'), config.get('server:host'))

module.exports = server