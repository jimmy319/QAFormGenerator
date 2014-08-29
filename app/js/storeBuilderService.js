var request = require('request');
var _ = require('underscore');
var Q = require('q');

var API_BASE_URL = 'https://gc.digitalriver.com/integration/job/request/';

/**
* sign in to GC and fetch user info
* @param username
*   user account
* @param password
*   password
* @param callback
*   will be invoked after api call has completed
*/
var login = function(username,password){
	var options = {
		headers: {'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(username,password)},
		url: API_BASE_URL+'ContentManagerAuthJSON/Admin/Site/',
		body: JSON.stringify({username:username})
	},
	deferred = Q.defer();

	request.post(options,function(error,response,body){
		if(error){
			deferred.reject({status:'failed',error:error});
		}else{
			if(response.statusCode===200){
				body.status = 'success';
			}else{
				body = {'status':'failed'};
			}
			deferred.resolve(body);
		}
	});

	return deferred.promise;
}
/**
* get the latest version of the siteID or templateID
* @param user
*   user object
* @param type
*   'template' or 'siteID'
* @param id
*   siteID or templateID
* @param callback
*   will be executed once the request has been completed
*/
var getLatestVersion = function(user, type, id){

	var data={}, deferred = Q.defer();
	data[type+'ID'] = id;

	var options = {
		headers: {'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(user.name, user.password)},
		url: API_BASE_URL+'ContentManagerGetSiteTemplateDetailsJSON/Admin/Site/',
		body: JSON.stringify(data)
	};

	request.post(options,function(error,response,body){
		var data = {};
		if(error){
			deferred.reject({status:'failed',error:error});
		}else{
			var body = JSON.parse(body);
			if(response.statusCode===200&&!body.hasOwnProperty('error')){
				var source = body.templates[0].versions, latest = _.findWhere(source,{status:"Design"});
				if(latest){
					data = {status:"success",version:latest};
					deferred.resolve(data);
				}else{
					deferred.reject({status:"failed"});
				}
			}else{
				data = {status:"failed"};
				deferred.reject(data);
			}
		} 
	});

	return deferred.promise;
}

/**
* fetch the big blue changes (Action, Page, Content Element) for specific template versionID and ticketID
* @param user
*  user object
* @param version
*  template version id
* @param ticketID
*  SR ticket id
* @param callback
*  will be executed once the request has been completed
*/

var getChanges = function(user, versionID, ticketID){
	var options = {
		headers: {'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(user.name,user.password)},
		url: API_BASE_URL+'ContentManagerGetSiteTemplateVersionDetailsJSON/Admin/Site/',
		body: JSON.stringify({siteTemplateVersionID:versionID})
	},
	deferred = Q.defer();;

	request.post(options,function(error,response,body){
		var data = {};
		if(error){
			deferred.reject({status:'failed',error:error});
		}else{
			if(response.statusCode===200&&!body.hasOwnProperty('error')){
				var source = JSON.parse(body).changeHistory, result = _.groupBy(_.filter(_.where(source,{ticketID:ticketID}),function(data){return data.actionTaken !== "Delete";}),"type");	
				data = {status:'success',data: result};
				deferred.resolve(data);
			}else{
				data = {status:'failed'};
				deferred.reject(data);
			}
			
		}
	});

	return deferred.promise;
}

/**
* fetch the user's style changes in GC for specific siteID
* @param user
*  user object
* @param siteID
*  site id
* @param state
*  'Design', 'Deployed', 'Retired'
* @param callback
*  will be executed once the request has been completed
*/
var getStyleChanges = function(user,siteID,state){
	var options = {
		headers: {'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(user.name,user.password)},
		url: API_BASE_URL+'ContentManagerGetStyleJSON/Admin/Site/',
		body: JSON.stringify({action:'getStyles',siteID:siteID,stateFilter:state})
	}
	,deferred = Q.defer();

	request.post(options,function(error,response,body){
		if(error){
			deferred.reject({status:'failed',erro:error});
		}else{
			var data = {};
			if(response.statusCode===200&&!body.hasOwnProperty('error')){
				var source = JSON.parse(body).stylesList, result = _.filter(source,function(data){ return data.lastModifiedBy.username===user.name });
				data = {status:'success',data:result};
				deferred.resolve(data);
			}else{
				data = {status:'failed'};
				deferred.reject(data);
			}
		}
	});

	return deferred.promise;
}

/**
* fetch the user's layout changes in GC for specific siteID
* @param user
*  user object
* @param siteID
*  site id
* @param state
*  'Design', 'Deployed', 'Retired'
* @param callback
*  will be executed once the request has been completed
*/
var getLayoutChanges = function(user,siteID,state){
	var options = {
		headers: {'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(user.name,user.password)},
		url: API_BASE_URL+'ContentManagerGetLayoutJSON/Admin/Site/',
		body: JSON.stringify({action:'getLayouts',siteID:siteID,stateFilter:state})
	}
	,deferred = Q.defer();

	request.post(options,function(error,response,body){
		if(error){
			deferred.reject({status:'failed',error:error});
		}else{
			var data = {};
			if(response.statusCode===200&&!body.hasOwnProperty('error')){
				var source = JSON.parse(body).pageGroups, result = getChangedLayouts(source);
				data = {status:'success',data:result};
				deferred.resolve(data);
			}else{
				data = {status:'failed'};
				deferred.reject(data);
			}
		}

		function getChangedLayouts(source){
			var targetPages = [], fullName = user.firstName+" "+user.lastName;
			for(var i=0,len=source.length;i<len;i++){
				if(!source[i].hasOwnProperty('pageGroups')){
					var pages = source[i].pageGroupPages;
					for(var j=0,len2=pages.length;j<len2;j++){
						targetPages=_.union(targetPages,_.where(pages[j].layoutMarkupPageBuilderPages,{state:"DESIGN",lastModifiedBy:fullName}));
					}
				}else{
					targetPages=_.union(targetPages,getChangedLayouts(source[i].pageGroups));
				}
			}
			return targetPages;
		}
	});

	return deferred.promise;
}

/**
* Helper function: DR cridential encrypter
*/
function getEncodedBasicAuth(username, password){
	return new Buffer(username + '@Admin:' + password).toString('base64');
}

module.exports = {
	login: login,
	getLatestVersion: getLatestVersion,
	getChanges: getChanges,
	getStyleChanges: getStyleChanges,
	getLayoutChanges: getLayoutChanges
};