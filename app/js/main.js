var app = angular.module('qaGeneratorApp',['ui.router','ngResource'])
.config(function($stateProvider, $urlRouterProvider){
	$stateProvider
		.state('login',{
			url: '/login',
			templateUrl: '/templates/loginView.html',
			controller: "loginCtrl"
		})
		.state('basicInfo',{
			url: '/basicInfo',
			templateUrl: '/templates/basicInfoView.html',
			controller: 'basicInfoCtrl'
		})
		.state('changes',{
			url: '/changes',
			templateUrl: '/templates/changesView.html',
			controller: 'changesCtrl'
		})
		.state('docgen',{
			url: '/docgen',
			templateUrl: '/templates/docgenView.html',
			controller: 'docgenCtrl'
		});
})
.controller('mainCtrl',function($scope,$state){
	$state.go('login');
})
.controller('loginCtrl',function($scope,$state,GCService,UserModel){
	$scope.isProcessing = false;
	$scope.hasError = false;

	$scope.onLogin = function(){
		if(!($scope.username&&$scope.pwd)){
			alert('Please enter completed information');
		}else{
			var sbService = require('../js/storeBuilderService.js');
			$scope.isProcessing = true;
			
			sbService.login($scope.username,$scope.pwd)
			.then(function(response){
				//console.log('This platform is ' + process.platform);
				$scope.isProcessing = false;
				response = typeof response === 'string' ? JSON.parse(response) : response;
				if(response.status==='success'){
					response.name = $scope.username;
					response.password = $scope.pwd;
					UserModel.set(response);
					$state.go('basicInfo');
				}else if(response.status==='failed'){
					$scope.hasError = true;
					$scope.errorMsg = "Username/password is not correct, please try again";
				}
			})
			.fail(function(error){
				$scope.isProcessing = false;
				$scope.hasError = true;
				$scope.errorMsg = "Server/Network error";
			})
			.done(function(){$scope.$apply();});
		}
	};
})
.controller('basicInfoCtrl',function($scope,$state,UserModel,BasicInfoModel){

	$scope.onSubmit = function(){

		if(!($scope.client&&($scope.siteID||$scope.templateID)&&$scope.ticketID)){
			alert("Please enter the required information");
		}else{
			if(UserModel.isset()){
				$scope.isProcessing = true;
				$scope.siteIDHasError = false,
				$scope.templateIDHasError = false;

				var sbService = require('../js/storeBuilderService.js');

				//multiple task
				if($scope.siteID&&$scope.templateID){
					var siteVersionID;

					sbService.getLatestVersion(UserModel.get(),'site',$scope.siteID)
					.then(function(response){
						siteVersionID = response.version.versionID;

						sbService.getLatestVersion(UserModel.get(),'template',$scope.templateID)
						.then(function(response){
							BasicInfoModel.set({siteInfo:{id:$scope.siteID,vid:siteVersionID},templateInfo:{id:$scope.templateID,vid:response.version.versionID},client:$scope.client,ticketID:$scope.ticketID});
							$state.go('changes');
						})
						.fail(function(){
							$scope.templateIDHasError=true;
							$scope.errorMsg='TemplateID is not valid';
							$scope.isProcessing = false;
							$scope.$apply();
						});
					})
					.fail(function(){
						$scope.siteIDHasError=true;
						$scope.errorMsg='SiteID is not valid or in QA testing';
						$scope.isProcessing = false;
						$scope.$apply();
					});
				}else{	//single task
					var type=$scope.siteID?'site':'template', id=$scope.siteID?$scope.siteID:$scope.templateID;

					sbService.getLatestVersion(UserModel.get(),type,id)
					.then(function(response){
						var data = {client:$scope.client,ticketID:$scope.ticketID};
						data[type+"Info"]={id:id,vid:response.version.versionID};
						BasicInfoModel.set(data);
						$state.go('changes');
						$scope.$apply();
					},
					function(response){
						if(type==='site'){
							$scope.siteIDHasError=true;
							$scope.errorMsg='SiteID is not valid or in QA testing';
						}else if(type==='template'){
							$scope.templateIDHasError=true;
							$scope.errorMsg='TemplateID is not valid';	
						}
						$scope.isProcessing = false;
						$scope.$apply();
					});
				}
			}
		}
	}
})
.controller('changesCtrl',function($scope,$state,UserModel,BasicInfoModel,QAFormModel){
	$scope.basicInfo = BasicInfoModel.get();

	var sbService = require('../js/storeBuilderService.js');

	//fetch BB, styles and content layout changes (site level) - if needed
	if($scope.basicInfo.hasOwnProperty('siteInfo')){
		//BB
		sbService.getChanges(UserModel.get(),$scope.basicInfo.siteInfo.vid,$scope.basicInfo.ticketID)
		.then(function(response){
			$scope.siteBBChanges = response.data;
			$scope.$apply();
		});

		//style
		sbService.getStyleChanges(UserModel.get(),$scope.basicInfo.siteInfo.id,'Design')
		.then(function(response){
			$scope.styleChanges = response.data;
			$scope.$apply();
		});

		//content layout
		sbService.getLayoutChanges(UserModel.get(),$scope.basicInfo.siteInfo.id,'Design')
		.then(function(response){
			$scope.layoutChanges = response.data;
			$scope.$apply();
		});
	}
	
	//fetch BB changes (template level) - if needed
	if($scope.basicInfo.hasOwnProperty('templateInfo')){
		sbService.getChanges(UserModel.get(),$scope.basicInfo.templateInfo.vid,$scope.basicInfo.ticketID)
		.then(function(response){
			$scope.tempBBChanges = response.data;
			$scope.$apply();
		});
	}
	
	$scope.onSubmit = function(){
		var qaFormData = {client:$scope.basicInfo.client,ticketID:$scope.basicInfo.ticketID};

		if($scope.basicInfo.hasOwnProperty('siteInfo')){
			qaFormData.siteID = $scope.basicInfo.siteInfo.id;
		}

		if($scope.basicInfo.hasOwnProperty('templateInfo')){
			qaFormData.templateID = $scope.basicInfo.siteInfo.id;
		}

		//site level bb changes
		var ce = [], action = [], page = [];
		if($scope.siteBBChanges){
			var ceCollection=$scope.siteBBChanges.ContentElement, actionCollection=$scope.siteBBChanges.Action, pageCollection=$scope.siteBBChanges.Page;
			
			if(ceCollection){
				for(var i=0,len=ceCollection.length;i<len;i++){
					var temp = {};
					temp.name = ceCollection[i].name;
					temp.isTempLevel = false;
					ce.push(temp);
				}
			}
			
			if(actionCollection){
				for(var i=0,len=actionCollection.length;i<len;i++){
					var temp = {};
					temp.name = actionCollection[i].name;
					temp.isTempLevel = false;
					action.push(temp);
				}
			}
			
			if(pageCollection){
				for(var i=0,len=pageCollection.length;i<len;i++){
					var temp = {};
					temp.name = pageCollection[i].name;
					temp.isTempLevel = false;
					page.push(temp);
				}
			}
		}

		//template level bb changes
		if($scope.tempBBChanges){
			var ceCollection=$scope.tempBBChanges.ContentElement, actionCollection=$scope.tempBBChanges.Action, pageCollection=$scope.tempBBChanges.Page;
			
			if(ceCollection){
				for(var i=0,len=ceCollection.length;i<len;i++){
					var temp = {};
					temp.name = ceCollection[i].name;
					temp.isTempLevel = true;
					ce.push(temp);
				}
			}
			
			if(actionCollection){
				for(var i=0,len=actionCollection.length;i<len;i++){
					var temp = {};
					temp.name = actionCollection[i].name;
					temp.isTempLevel = true;
					action.push(temp);
				}
			}
			
			if(pageCollection){
				for(var i=0,len=pageCollection.length;i<len;i++){
					var temp = {};
					temp.name = pageCollection[i].name;
					temp.isTempLevel = true;
					page.push(temp);
				}
			}
		}

		qaFormData.ce = ce;
		qaFormData.page = page;
		qaFormData.action = action;

		//styles
		var style = [];
		if($scope.styleChanges){
			for(var i=0,len=$scope.styleChanges.length;i<len;i++){
				var temp = {id:$scope.styleChanges[i].id,ver:$scope.styleChanges[i].version,name:$scope.styleChanges[i].name};
				style.push(temp);
			}
		}
		qaFormData.style = style;

		//layouts
		var layout = [];
		if($scope.layoutChanges){
			for(var i=0,len=$scope.layoutChanges.length;i<len;i++){
				var temp = {id:$scope.layoutChanges[i].id,ver:$scope.layoutChanges[i].version,name:$scope.layoutChanges[i].pageName};
				layout.push(temp);
			}
		}
		qaFormData.layout = layout;

		QAFormModel.set(qaFormData);

		$state.go('docgen');
	}
})
.controller('docgenCtrl',function($scope,QAFormModel){
	var filePath='';
	var holder = document.getElementById('holder');

	window.ondragover = function(e) {e.preventDefault(); return false;};
	window.ondrop = function(e) {e.preventDefault(); return false;};

	holder.ondragover = function(){ this.className = 'hover'; return false; };
	holder.ondragend = function(){ this.className = ''; return false; };
	holder.ondrop = function(e){ 
		e.preventDefault();

		for (var i=0;i<e.dataTransfer.files.length;++i){
			filePath = e.dataTransfer.files[i].path;
			$scope.filePath = filePath;
			$scope.$apply();
		}
		
		return false;
	};

	$scope.docxgen = function(){
		new DocxGen().loadFromFile(filePath, { async: true } ).success(function(docx) {
		docx.setTags(QAFormModel.get());
		docx.applyTags();
		out=docx.output({name:QAFormModel.get().ticketID+'_QAForm.docx'});
		});
	}

});

app.factory('UserModel',function(){
	var userModel={};
	//private members
	var user;

	userModel.isset = function(){
		return user!==undefined;
	}

	userModel.set = function(data){
		user = data;
	}

	userModel.get = function(){
		return user;
	}

	return userModel;
});
app.factory('BasicInfoModel',function(){
	var basicInfoModel = {}, basicInfo;

	basicInfoModel.isset = function(){
		return basicInfo!==undefined;
	}

	basicInfoModel.get = function(){
		return basicInfo;
	}

	basicInfoModel.set = function(data){
		basicInfo = data;
	}

	return basicInfoModel;
});
app.factory('QAFormModel',function(){
	var qaFormModel = {}, qaForm;

	qaFormModel.isset = function(){
		return qaForm!==undefined;
	}

	qaFormModel.get = function(){
		return qaForm;
	}

	qaFormModel.set = function(data){
		qaForm = data;
	}

	return qaFormModel;
});
app.factory('GCService',['$resource', function($resource){
	
	function getEncodedBasicAuth(username, password){
		return new Buffer(username + '@Admin:' + password).toString('base64');
	}

	return {
		login: function(username,password){
			var deferred = $.Deferred();

			$.ajax({
				url: 'https://gc.digitalriver.com/integration/job/request/ContentManagerAuthJSON/Admin/Site/',
				type: 'POST',
				headers:{'Content-Type':'text\/xml','Authorization':'Basic '+getEncodedBasicAuth(username,password)},
				data: JSON.stringify({username:username})
			}).done(function(response,status){
				response = typeof response === 'string' ? JSON.parse(response) : response;
				if(status==='success'){
					response.status = 'success';
				}else{
					response = {'status':'failed'};
				}
				deferred.resolve(response);
			}).fail(function(response){
				deferred.reject('Username/password is not correct, please try again');
			});

			return deferred.promise();
		}
	};
}]);