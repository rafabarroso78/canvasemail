const functions = require('firebase-functions');
const {google} = require('googleapis');
const admin = require('firebase-admin');
var querystring = require('querystring');
var https = require('https');
admin.initializeApp(functions.config().firebase);

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
const host = 'api.handwrytten.com';
var username = 'admin@canvaslabs.ai';
var password = 'XXXXXXXXXX';
var sessionId = null;

function getCredentials() {
    return {"web":{"client_id":"266754714384-lch26a5absp61e9ojddhr8g3vit9ovfc.apps.googleusercontent.com","project_id":"canvas-prod-3ceb3","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"RNewrmvFyicGut1YEeipTUm5","redirect_uris":["https://us-central1-canvas-prod-3ceb3.cloudfunctions.net/token"], "javascript_origins":["https://us-central1-canvas-prod-3ceb3.cloudfunctions.net"]}}
    //Replace this empty object with credentials.json contents
}

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

exports.getAuthorizeUrl = functions.https.onRequest((request, response) => {
    console.log('Authorize called')
    if(request.query.user_id)
    {
    	userId = request.query.user_id
    	const {client_secret, client_id, redirect_uris} = getCredentials().web
    	if(!client_secret || !client_id || !redirect_uris)
        response.send("Credentials missing").status(500)
    	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    	let url = oAuth2Client.generateAuthUrl({
        	access_type: 'offline',
        	scope: SCOPES,
        	prompt: 'consent',
        	state: JSON.stringify({ user_id: userId})
    	})
    	response.send(url)
	}
	else
	{
		response.send('User ID missing!')
	}
})

exports.token = functions.https.onRequest((request, response) => {
    console.log('token called ' + JSON.stringify(request.body))
    const code = request && request.query && request.query.code || null
    console.log(request.query)
    const userId = JSON.parse(request.query.state)
    console.log(request.query.state)
    if(!code)
        response.send("code missing").status(400)

    const {client_secret, client_id, redirect_uris} = getCredentials().web
    if(!client_secret || !client_id || !redirect_uris)
        response.send("Credentials missing").status(500)

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    oAuth2Client.getToken(code, (err, token) => {
        if(err) {
            console.log('err ' + err.message)
            response.status(500).send("Unable to generate token " + err.message)
        }
        console.log(token)
        console.log('Refresh Token!')
        const refToken = token.refresh_token
        oAuth2Client.setCredentials(token)
        console.log('HERE COMES THE USERID AGAIN:')
   		console.log(userId.user_id)
   		console.log(refToken)
   		const thisUserId = userId.user_id

   		setUserToken(thisUserId, refToken)
   		.then(result =>{
   			response.send("Access Granted. Please close this tab and return to the Canvas App.")	
   		})
   		.catch(error => {
   			response.send("There was a problem authorizing your account :(")
   		})
    })
})


exports.gift_authorize = functions.https.onRequest((request, response) => {
    console.log('Authorize called')

    const {client_secret, client_id, redirect_uris} = getCredentials().web
    if(!client_secret || !client_id || !redirect_uris)
        response.send("Credentials missing").status(500)

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    let url = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    })
    response.send(url)
})


exports.gift_token = functions.https.onRequest((request, response) => {
    console.log('token called ' + JSON.stringify(request.body))
    const code = request && request.query && request.query.code || null
    if(!code)
        response.send("code missing").status(400)

    const {client_secret, client_id, redirect_uris} = getCredentials().web
    if(!client_secret || !client_id || !redirect_uris)
        response.send("Credentials missing").status(500)

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
    oAuth2Client.getToken(code, (err, token) => {
        if(err) {
            console.log('err ' + err.message)
            response.status(500).send("Unable to generate token " + err.message)
        }
        console.log(token)
        oAuth2Client.setCredentials(token)

        generateGiftTasks(oAuth2Client)
        response.send("Access Granted. Please close this tab and continue")
    })
})


exports.scheduledCalendarCheck = functions.pubsub.schedule('*/5 * * * *')
	.timeZone('America/New_York')
	.onRun((context) => {

		getEvents();

		return 0

	});

function getEvents(){
	// console.log('proceeding to look for events for:')
	const db = admin.firestore();
	const docRef = db.collection('users')
	docRef.where('token', '!=', false).get()
	.then(snapshot => {
		snapshot.forEach(doc => {
			docRef.doc(doc.id).get().then(res => {
			userName = res.data().fname
			console.log(userName)
			userId = doc.id
			userToken = res.data().token 
			console.log('inside find_events main function')
			const {client_secret, client_id, redirect_uris} = getCredentials().web
			const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
			oAuth2Client.setCredentials({refresh_token: userToken })
			generateGiftTasks2(oAuth2Client, userId)
			})
		})
	})
	.catch(error =>{
		//Handle the error
		console.log(error)
	})
}

exports.pullEvents = functions.https.onRequest((request, response)=>{
	// console.log('proceeding to look for events for:')
	const db = admin.firestore();
	const docRef = db.collection('users')
	docRef.where('token', '!=', false).get()
	.then(snapshot => {
		snapshot.forEach(doc => {
			docRef.doc(doc.id).get().then(res => {
			userName = res.data().fname
			console.log(userName)
			userId = doc.id
			userToken = res.data().token 
			console.log('inside find_events main function')
			const {client_secret, client_id, redirect_uris} = getCredentials().web
			const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
			oAuth2Client.setCredentials({refresh_token: userToken })
			generateGiftTasks2(oAuth2Client, userId)
			})
		})
		response.send('done!')
	})
	.catch(error =>{
		//Handle the error
		console.log(error)
		response.status(500).send(error)
	})
})

exports.users_cal_access = functions.https.onRequest((request, response)=>{
	// console.log('getting all users')
	const db = admin.firestore();
	const docRef = db.collection('users');
	docRef.get()
	.then(snapshot => {
		snapshot.forEach(doc => {
		// console.log(doc.id)
		// console.log('extracting parameters')
		docRef.doc(doc.id).get().then(token => {
			// console.log('This is the token for:')
			userName = token.data().fname
			// console.log(userName)
			userId = doc.id
			// console.log(userId)
			userToken = token.data().token 
			if(userToken != null)
			{
				// console.log('proceeding to look for events for:')
				console.log(userName)
				findEvents(userToken, userId)

			}else
			{ 
				// console.log('this user has cal integration disabled')
				// console.log('skipping')
			}
			response.send()
			})
		})
	})
	.catch(error =>{
		//Handle the error
		console.log(error)
		response.status(500).send(error)
		})
})


let findEvents = async function(userToken, userId){
    console.log('inside find_events main function')
    console.log(userId)
    console.log(userToken)
	const {client_secret, client_id, redirect_uris} = getCredentials().web
	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
		oAuth2Client.setCredentials({refresh_token: userToken })
		generateGiftTasks(oAuth2Client, userId)
	.then(result => {
		return
	})
	.catch(error =>{
	//Handle the error
		console.log(error)
		return
	})
}

exports.gift_events = functions.https.onRequest((request, response) => {
    var giftCalEvents = ['events go here']
    // rafa@canvaslabs.ai
    var  userId = 'VC52RleuFUhEyqztzwn6RGyCOjj2'
    // rafaelbarroso@gmail.com
    // var  userId = 'ydu3OTr83mQeKUaJu0vfgyabfuo1'
    console.log('USER TOKEN BELOW:')
    getUserToken(userId)
    .then(function(token){

    	console.log(token)
    	const {client_secret, client_id, redirect_uris} = getCredentials().web
    	const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])
   		oAuth2Client.setCredentials({refresh_token: token })
   		console.log('HERE COMES THE EMAIL:')
   		var oauth2 = google.oauth2({
		  auth: oAuth2Client,
		  version: 'v2'
		});
   		generateGiftTasks(oAuth2Client, userId)
		.then(result => {
		response.send()
		})
		.catch(error =>{
		//Handle the error
		console.log(error)
		response.status(500).send(error)
		})
    })
	.catch(error =>{
		//Handle the error
		console.log(error)
		response.status(500).send(error)
	})
})

let getUserToken = function (userId){
	const db = admin.firestore()
	const docRef = db.collection('users').doc(userId)
	return docRef.get().then(userinfo => { 
		console.log(userinfo.data())
		return userinfo.data().token})
}

let storeNewTask = async function(newTask, userId, giftId){
	const db = admin.firestore()
	console.log('Info about to be stored!')
	console.log(newTask)
	// const docRef = db.collection('users').doc(userId)
	console.log(giftId)
	query =  db.collection('users').doc(userId).collection("tasks").where("gift_event_id", "==", giftId)
	query.get().then(snapshot => {
		if(snapshot.empty)
		{
			console.log('does not exist so store it!')
			return db.collection('users').doc(userId).collection('tasks').add(newTask).then(res=>{ 
				console.log('This is the new ID')
				console.log(res.id)
				db.collection('users').doc(userId).collection('tasks').doc(res.id).update({ task_id : res.id}).then(res2=>{
					return res2
				})
			})
		}
		else
		{
			console.log('does exists, do not do anything!')
			return
		}
	})
}


let setUserToken = async function(userId, Token){
	const db = admin.firestore()
	console.log('Token about to be stored!')
	console.log(userId)
	console.log(Token)
  	console.log('Successfully fetched user data:');
  	db.collection('users').doc(userId).update({token : Token})
  	.then(res =>{
		console.log('token updated!')
  	 	return res
  	 })
  	 .catch(error =>{
  	 	console.log('an issue occured while updating token:', error)
  	 	return error
  	 })
 }

async function getUserId() {

	const db = admin.firestore();
	const docRef = db.collection('users');
	const snapshot = await docRef.get();
	snapshot.forEach(doc => {
		getRecurring(doc.id)

	})
}


exports.call_nlp = functions.https.onRequest((request, response) => {
	console.log('executing nlp test')
	var eventText = "Chris' Birthday Party"
	extractName(eventText)
	.then(result =>{
		response.send(result)
	})
})

async function extractName(eventText) {
return new Promise(async function(resolve,reject){
  // Imports the Google Cloud client library
  const language = require('@google-cloud/language');

  // Instantiates a client
  const client = new language.LanguageServiceClient();

  // The text to analyze
  const text = eventText

  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

 // Detects entities in the document
	const [result] =  await client.analyzeEntities({document});

	const entities = result.entities;
	var people = [] 

	// console.log('Entities:');
	entities.forEach(entity => {
	  // console.log(entity.name);
	  // console.log(` - Type: ${entity.type}, Salience: ${entity.salience}`);
	  if (entity.type == 'PERSON')
	  {
	  	people.push(entity.name)
	  }
	});
	resolve(people)
})
}

function generateGiftTasks2(auth, userId) {
	const giftEvents = ['birthday', 'bday', 'anniversary', 'celebration', 'wedding', 'quinceanera', 'bar mitzvah', 'shower', 'graduation', 'ceremony','farewell'] 
	var calevents = []
	var eventCount = 0

	// Initializes Google Calendar API
    console.log('Im in the generate Gift task function')
    const calendar = google.calendar({version: 'v3', auth})
    console.log('created calendar auth client')
    calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
      }).then(function(res){
      	// Looks for events that normally require to buy gifts
    	 console.log('I retrieved the calendar events!!!!')
    	 const events = res.data.items
		        if (events.length) {
		          events.forEach(function(event){
		            var start = event.start.dateTime || event.start.date;
		            var newEventTask = {}
		            var isGift = 0
		            calevent = event.summary.toLowerCase()
		            for(i=0; i<giftEvents.length; i++){
		            	if(calevent.search(giftEvents[i]) != -1)
		            	{
		            		isGift = 1;
		            	}
		            }
		            // If it is a gift event, create task object
		            if(isGift == 1){
						extractName(event.summary).then(people=>{
							if(people.length > 1)
							{
								recipients = ''+people
								console.log(recipients)
								recipients = recipients.replace(/,/g, ' and ')
							}
							else
							{
								recipients = people+''
								console.log(recipients)
							}
							
							const newDate = new Date(start)
							const formatNewDate = newDate.toString('MM dd, YYYY')
							const giftId = start.substr(1,9) + '-' + recipients.substr(0,4)
							console.log('recipients value:')
							console.log(recipients)
							const recipientsFormatted = recipients == '' ? event.summary : recipients
							console.log(recipientsFormatted)
							const taskData = {
				            	active: true,
				            	badge: '',
				               	date:  admin.firestore.Timestamp.fromDate(new Date(formatNewDate)),
					            group: 'Canvas',
					            group_id: null,
					            notes: "This task has been auto-generated by Canvas AI based on your Google Calendar event on "+formatNewDate.substr(0,10)+": "+event.summary+".",
					            notifications_active: false,
					            notifications_id: null,
					            recurring: false,
					            recurring_active: false,
					            recurring_id: null,
					            recurring_type: "",
					            task: 'Buy Gift for ' + recipientsFormatted,
			            		gift_event_id: giftId,
			            		task_id: null
			        		}
			            	calevents.push(newEventTask)
			            	//createCard(start, calevent)
			            	storeNewTask(taskData, userId, giftId)
			            	.then(function(res){
			            		//console.log(res)
			            	})
						})
		            }
		          	})
		        } else {
		          calevents = ['No upcoming gift events found.'];
		          reject(calevents)
		        }
		    return
      })
      .catch(error =>{
		console.log(error)
		return
	   })
}

async function generateGiftTasks(auth, userId) {
		const giftEvents = ['birthday', 'bday', 'anniversary', 'celebration', 'wedding', 'quinceanera', 'bar mitzvah', 'shower', 'graduation', 'ceremony','farewell']
		var calevents = []
		var eventCount = 0

		// Initializes Google Calendar API
	    console.log('Im in the generate Gift task function')
	    const calendar = google.calendar({version: 'v3', auth})
	    console.log('created calendar auth client')
	    calendar.events.list({
	        calendarId: 'primary',
	        timeMin: (new Date()).toISOString(),
	        maxResults: 10,
	        singleEvents: true,
	        orderBy: 'startTime',
	      }).then(function(res){
	      	// Looks for events that normally require to buy gifts
	    	 console.log('I retrieved the calendar events!!!!')
	    	 const events = res.data.items
		        if (events.length) {
		          events.forEach(function(event){
		            var start = event.start.dateTime || event.start.date;
		            var newEventTask = {}
		            var isGift = 0
		            calevent = event.summary.toLowerCase()
		            for(i=0; i<giftEvents.length; i++){
		            	if(calevent.search(giftEvents[i]) != -1)
		            	{
		            		isGift = 1;
		            	}
		            }
		            // If it is a gift event, create task object
		            if(isGift == 1){
						extractName(event.summary).then(people=>{
							if(people.length > 1)
							{
								recipients = ''+people
								console.log(recipients)
								recipients = recipients.replace(/,/g, ' and ')
							}
							else
							{
								recipients = people+''
								console.log(recipients)
							}
							
							const newDate = new Date(start)
							const formatNewDate = newDate.toString('MM dd, YYYY')
							const giftId = start.substr(1,9) + '-' + recipients.substr(0,4)
							console.log('recipients value:')
							console.log(recipients)
							const recipientsFormatted = recipients == '' ? event.summary : recipients
							console.log(recipientsFormatted)
							const taskData = {
				            	active: true,
				            	badge: '',
				               	date:  admin.firestore.Timestamp.fromDate(new Date(formatNewDate)),
					            group: 'Canvas',
					            group_id: null,
					            notes: "This task has been auto-generated by Canvas AI based on your Google Calendar event on "+newDate+", "+event.summary+".",
					            notifications_active: false,
					            notifications_id: null,
					            recurring: false,
					            recurring_active: false,
					            recurring_id: null,
					            recurring_type: "",
					            task: 'Buy Gift for ' + recipientsFormatted,
			            		gift_event_id: giftId,
			            		task_id: null
			        		}
			            	calevents.push(newEventTask)
			            	//createCard(start, calevent)
			            	storeNewTask(taskData, userId, giftId)
			            	.then(function(res){
			            		//console.log(res)
			            	})
						})
		            }
		          	})
		        } else {
		          calevents = ['No upcoming gift events found.'];
		          reject(calevents)
		        }
		    return
	      })
	      .catch(error =>{
			console.log(error)
		   })
	      return
}

function createCard(date, event) {
	console.log('creating handwrytten card')
	var cardDate = date 
	var cardEvent = event

	// Handwrytten login
	performRequest('/v1/auth/authorization', 'POST', {
	    login: username,
	    password: password
	  }, function(data) {
	    sessionId = data.uid;
	    console.log('Logged in:', sessionId);
	  });

	//
}

function performRequest(endpoint, method, data, success) {
  var dataString = JSON.stringify(data);
  var headers = {};

  console.log('calling Handwrytten API')
  
  if (method == 'GET') {
    endpoint += '?' + querystring.stringify(data);
  }
  else {
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length
    };
  }
  var options = {
    host: host,
    path: endpoint,
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
      console.log(responseString);
      var responseObject = JSON.parse(responseString);
      success(responseObject);
    });
  });

  req.write(dataString);
  req.end();
}