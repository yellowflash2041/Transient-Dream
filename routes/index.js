var express = require('express');
const chalk = require('chalk');
const passport = require('passport');
const Yelp = require('yelp');
// Remember we are in the /routes directory, hence the "../"
const Patrons = require('../models/patrons.js');
var router = express.Router();

const yelp = new Yelp({
  consumer_key: process.env.YELP_CONSUMER_KEY,
  consumer_secret: process.env.YELP_CONSUMER_SECRET,
  token: process.env.YELP_TOKEN,
  token_secret: process.env.YELP_TOKEN_SECRET
});

const isAuthed = (req, res, next) => {
  if (req.user) {
    return next();
  }

  res.status(401).send('Not authenticated');
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', (err, html) => {
    if (err) {
      console.error(err);
    }
    res.send(html);
  });
});

router.get('/auth/twitter', (req, res, next) => {
  req.session.cburl = req.query.cbHash;
  passport.authenticate('twitter', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
    }
  })(req, res, next);
});

router.get('/auth/twitter/callback', passport.authenticate('twitter', {
  successRedirect : '/authreturn',
  failureRedirect : '/'
}));

router.get('/authreturn', (req, res) => {
  if (typeof req.session.cbHash !== 'undefined' && req.session.cbHash.length > 0) {
    res.redirect('/' + req.session.cbHash); // This preceding slash is required so the redirect will not be relative to '/authreturn'

    res.end(); // End this request since the browser will make a seperate request for the page we are redirecting to
  }
  else {
    res.render('index', (err, html) => {
      if (err) {
        console.error(err);
      }
      res.send(html);
    });
  }
});

router.post('/getPatronCounts', (req, res) => {
  const queryArray = [];

  for (let prop in req.body) {
    queryArray.push(req.body[prop]);
  }

  // This query works fine in MongoCompass...
  db.collection('fccnlca-patrons').aggregate(
    [{
      $match: {
        'listingId': { $in: queryArray }
      }
    }, {
      $project: { 
        '_id': 0,
        'listingId': 1, 
        'nPatrons': { 
          $size: '$patrons'
        }
      }
    }]
  ).toArray((err, result) => {
    if (err) {
      console.log(chalk.bgRed.white('The query generated an error.'));
    }
    res.json(result);
  });
});

router.post('/imgoing', isAuthed, (req, res) => {
  console.log(chalk.green("Someone's going!"));
  const listingId = req.body.listingId;
  Patrons.findOne({"listingId": listingId}).then(result => {
    if (result === null) {
      console.log(chalk.gray('Listing does not exist, yet...'));
      const patron = new Patrons();
      patron.listingId = listingId;
      const user = { 
        provider: req.user.provider, 
        id: req.user.id, 
        username: req.user.username
      };
      patron.patrons.push(user);
      patron.save(err => {
        if (err) {
          res.status(500);
          console.error(`Error while saving listing: ${err}`);
        }
        else {
          console.log(chalk.green('Patron saved to newly created listing'));
          res.json({ listingId: listingId, status: 'added' });
          console.log('New listing w/ patron created without errors');
        }
      });
    } else {
      console.log(chalk.green('Listing already exists! Here are the current patrons...'));
      console.log(`There are ${result.patrons.length} patron(s)`);
      let userExists = false;
      for (let i = 0; i < result.patrons.length; i++) {
        if (
          result.patrons[i].provider === req.user.provider &&
          result.patrons[i].id === req.user.id &&
          result.patrons[i].username === req.user.username
        ) {
          userExists = true;
        }
      }

      if (userExists) {
        // If the user exists, then he/she has clicked the button again to indicate they are not going (anymore). Remove the user from the array. This can be done using $pull          
        console.log(chalk.yellow('User already exists in listing...'));
        console.log(chalk.yellow('Removing user from patrons list...'));
        db.collection('fccnlca-patrons').update(
          { listingId },
          { $pull: { patrons: { id: req.user.id } } },
          (err, results) => {
            if (err) {
              console.error(chalk.red(`Error: ${err}`));
            }
            res.json({ listingId, status: 'removed'});
          }
        );
        return;
      } else {
        const patron = new Patrons();
        const user = {
          provider: req.user.provider, 
          id: req.user.id, 
          username: req.user.username
        };

        result.patrons.push(user);
        result.save().then(data => {
          console.log(chalk.green('Patron saved to existing listing'));
          res.json({ listingId, status: 'added' });
        }).catch(err => {
          console.error(chalk.red(`Error while saving patron to existing listing: ${err}`));
        });
      }
    }
  }, err => {
    console.error(chalk.red('Error') + `: ${err.stack}`);
  });
});

router.post('/search', (req, res, next) => {
  const query = req.body.query;
  if (/^\d{5}$|^\d{5}-\d{4}$/.test(query)) {
    yelp.search({ term: 'bars', location: query })
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        console.error(err); 
      });
  } else if (/^(\+|\-)?([0-8]\d|90|[0-9])(\.\d{1,10}),\ ?(\+|\-)?(1[0-7]\d|\|180|\d\d?)(\.\d{1,10})?$/.test(query)) {
    // https://www.yelp.com/developers/documentation/v2/search_api#searchGC
    yelp.search({ term: 'bars', ll: query })
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        console.error(err);
        res.json({ error: err });
      });
  } else {
    yelp.search({ term: 'bars', location: query })
      .then(data => {
        res.json(data);
      })
      .catch(err => {
        console.error(err);
        res.json({ error: err });
      });
  }
});

module.exports = router;
