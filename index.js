//import required module
const express = require('express');
const app = express();
const bodyParser = require('body-parser'); //post body handler
const Sequelize = require('sequelize'); //Database ORM
const { check, validationResult } = require('express-validator/check'); //form validation
const { matchedData, sanitize } = require('express-validator/filter'); //sanitize form params
const multer  = require('multer'); //multipar form-data
const path = require('path');
const crypto = require('crypto');

//Set body parser for HTTP post operation
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

//set static assets to public directory
app.use(express.static('public'));
const uploadDir = '/img/';
const storage = multer.diskStorage({
    destination: "./public"+uploadDir,
    filename: function (req, file, cb) {
      crypto.pseudoRandomBytes(16, function (err, raw) {
        if (err) return cb(err)  

        cb(null, raw.toString('hex') + path.extname(file.originalname))
      })
    }
})

const upload = multer({storage: storage, dest: uploadDir });

//Set app config
const port = 3000;
const baseUrl = 'http://localhost:'+port;

//Connect to database
const sequelize = new Sequelize('comicstore', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',
    pool: {
        max: 5,
        min: 0,
        idle: 10000
    }
});

//Define models
const comic = sequelize.define('comic', {
    'id': {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    'isbn': Sequelize.STRING,
    'name': Sequelize.STRING,
    'year': Sequelize.STRING,
    'author': Sequelize.STRING,
    'description': Sequelize.TEXT,
    'image': {
        type: Sequelize.STRING,
        //Set custom getter for comic image using URL
        get(){
            const image = this.getDataValue('image');
            return uploadDir+image;
        }
    },
    'createdAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },    
    'updatedAt': {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
    },   
    
}, {
    //prevent sequelize transform table name into plural
    freezeTableName: true,
})

/**
 * Set Routes for CRUD
 */

//get all comics
app.get('/comic/', (req, res) => {
    comic.findAll().then(comic => {
        res.json(comic)
    })
})

//get comic by isbn
app.get('/comic/:isbn', (req, res) => {
    comic.findOne({where: {isbn: req.params.isbn}}).then(comic => {
        res.json(comic)
    })
})

//Insert operation
app.post('/comic/', [
    //File upload (karena pakai multer, tempatkan di posisi pertama agar membaca multipar form-data)
    upload.single('image'),

    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return comic.findOne({where: {isbn: value}}).then(b => {
                if(b){
                    throw new Error('ISBN already in use');
                }            
            })
        }
    ),
    check('name')
        .isLength({min: 2}),
    check('year')
        .isLength({min: 4, max: 4})
        .isNumeric(),
    check('author')
        .isLength({min: 2}),
    check('description')
     .isLength({min: 10})

],(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }

    comic.create({
        name: req.body.name,
        isbn: req.body.isbn,
        year: req.body.year,
        author: req.body.author,
        description: req.body.description,
        image: req.file === undefined ? "" : req.file.filename
    }).then(newcomic => {
        res.json({
            "status":"success",
            "message":"comic added",
            "data": newcomic
        })
    })
})

//Update operation
app.put('/comic/', [
    //File upload (karena pakai multer, tempatkan di posisi pertama agar membaca multipar form-data)
    upload.single('image'),

    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return comic.findOne({where: {isbn: value}}).then(b => {
                if(!b){
                    throw new Error('ISBN not found');
                }            
            })
        }
    ),
    check('name')
        .isLength({min: 2}),
    check('year')
        .isLength({min: 4, max: 4})
        .isNumeric(),
    check('author')
        .isLength({min: 2}),
    check('description')
     .isLength({min: 10})

],(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.mapped() });
    }
    const update = {
        name: req.body.name,
        isbn: req.body.isbn,
        year: req.body.year,
        author: req.body.author,
        description: req.body.description,
        image: req.file === undefined ? "" : req.file.filename
    }
    comic.update(update,{where: {isbn: req.body.isbn}})
        .then(affectedRow => {
            return comic.findOne({where: {isbn: req.body.isbn}})      
        })
        .then(b => {
            res.json({
                "status": "success",
                "message": "comic updated",
                "data": b
            })
        })
})

app.delete('/comic/:isbn',[
    //Set form validation rule
    check('isbn')
        .isLength({ min: 5 })
        .isNumeric()
        .custom(value => {
            return comic.findOne({where: {isbn: value}}).then(b => {
                if(!b){
                    throw new Error('ISBN not found');
                }            
            })
        }
    ),
], (req, res) => {
    comic.destroy({where: {isbn: req.params.isbn}})
        .then(affectedRow => {
            if(affectedRow){
                return {
                    "status":"success",
                    "message": "comic deleted",
                    "data": null
                } 
            }

            return {
                "status":"error",
                "message": "Failed",
                "data": null
            } 
                
        })
        .then(r => {
            res.json(r)
        })
})


app.listen(port, () => console.log("comic-rest-api run on "+baseUrl ))