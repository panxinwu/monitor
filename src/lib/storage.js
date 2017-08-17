const MongoClient = require('mongodb').MongoClient
const url = 'mongodb://localhost:27017/jd_monitor'

const insertDocuments = function(db, badImageList, callback) {
	console.log('insertDocuments', badImageList)
  let collection = db.collection('badImageData')
  collection.insertOne(badImageList, function(err, result) {
    if(err) return
    callback(result)
  });
}

const saveData = function(badImageList, doPhantom, exit){
	if(!badImageList){
		exit()
		doPhantom()
		return
	}

	MongoClient.connect(url, function(err, db) {
		insertDocuments(db,badImageList.data, function() {
			db.close()
			exit()
			doPhantom()
		})
	})

}

export {saveData}