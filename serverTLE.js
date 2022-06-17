const express = require('express');
const axios = require('axios')
const satellite = require('satellite.js');
const app = express();

app.use(express.json());

const tle_galileo = "http://www.celestrak.com/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle";
const tle_gps = "http://www.celestrak.com/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle";
const tle_glonass = "http://www.celestrak.com/NORAD/elements/gp.php?GROUP=glo-ops&FORMAT=tle";
const tle_beidou = "http://www.celestrak.com/NORAD/elements/gp.php?GROUP=beidou&FORMAT=tle";


const glonass_json = [{"svn":"719", "prn":"20"},	
{"svn":"720", "prn":"19"},	
{"svn":"721", "prn":"13"},	
{"svn":"730", "prn":"1"	},
{"svn":"732", "prn":"23"},	
{"svn":"735", "prn":"22"},	
{"svn":"736", "prn":"16"},
{"svn":"743", "prn":"8"	},
{"svn":"744", "prn":"3"	},
{"svn":"745", "prn":"7"	},
{"svn":"747", "prn":"2"	},
{"svn":"754", "prn":"18"},	
{"svn":"755", "prn":"21"},	
{"svn":"702", "prn":"9"	},
{"svn":"751", "prn":"17"},	
{"svn":"752", "prn":"14"},
{"svn":"756", "prn":"5"},
{"svn":"757", "prn":"15"},
{"svn":"758", "prn":"12"},
{"svn":"759", "prn":"4"},
{"svn":"760", "prn":"24"},
{"svn":"705", "prn":"11"}];

app.post('/getSatellites', (req, res) =>{
	let data = req.body;
	let latitude = data["lat"];
	let longitude = data["lon"];
	let elemask = 10;
	if(data["elemask"]){
		elemask = parseInt(data["elemask"]);
	}
	let sel_const = data["type"];
	if(typeof sel_const === 'undefined'){
		sel_const = "GALILEO";
	}
	if(isNaN(latitude) || isNaN(longitude) || isNaN(elemask)){
		res.send({ "error":"bad input"});
	}else{
		let returnJson = {};
		
		let curr_url = "";
		if(sel_const == "GALILEO"){
			curr_url = tle_galileo;
		}else if(sel_const == "GPS"){
			curr_url = tle_gps;
		}else if(sel_const == "GLONASS"){
			curr_url = tle_glonass;
		}else if(sel_const == "BEIDOU"){
			curr_url = tle_beidou;
		}
		
		axios.get(curr_url).then(axres => {
			tlesplit = axres.data.split("\n");
			ntle = Math.floor(tlesplit.length / 3);

			for(let i=0; i<ntle; i++){
				let satnamefull = tlesplit[3 * i];
				let satname = "";

				if(sel_const == "GALILEO"){
					satname = satnamefull.substring(satnamefull.indexOf("(PRN ")+5, satnamefull.indexOf(")"));
				}else if(sel_const == "GLONASS"){
					let satsvn = (satnamefull.substring(satnamefull.indexOf("(")+1, satnamefull.indexOf(")"))).substring(0,3);
					try{
						satname = glonass_json.find(sat => sat.svn == satsvn).prn;
					}catch(e){
						satname = "";
					}
					constType = "GLONASS";
				}else if(sel_const == "GPS"){
					satname = "G"+satnamefull.substring(satnamefull.indexOf("(PRN ")+5, satnamefull.indexOf(")"));
					constType = "GPS";
				}else if(sel_const == "BEIDOU"){
					satname = satnamefull.substring(satnamefull.indexOf("(")+1, satnamefull.indexOf(")"));
					constType = "BEIDOU";
				}
				
				let firsttle = tlesplit[3 * i + 1].replace("\r","");
				let sectle = tlesplit[3 * i + 2].replace("\r","");
				var satrec = satellite.twoline2satrec(firsttle, sectle);
				var now = new Date();
				var positionAndVelocity = satellite.propagate(satrec, now);
		
				var positionEci = positionAndVelocity.position,
				velocityEci = positionAndVelocity.velocity;
				
				var observerGd = {
					longitude: satellite.degreesToRadians(longitude),
					latitude: satellite.degreesToRadians(latitude),
					height: 0
				};
				
				var gmst = satellite.gstime(now);
				
				var positionEcf   = satellite.eciToEcf(positionEci, gmst),
				observerEcf   = satellite.geodeticToEcf(observerGd),
				positionGd    = satellite.eciToGeodetic(positionEci, gmst),
				lookAngles    = satellite.ecfToLookAngles(observerGd, positionEcf);

				let azimuth = satellite.radiansToDegrees(lookAngles.azimuth);
				let elevation = satellite.radiansToDegrees(lookAngles.elevation);
				if(	elevation >= elemask && 
					satname != "" &&
					satname.indexOf("GSAT") == -1 &&
					satname.indexOf("GAGAN") == -1
					)
				{
					returnJson[satname] = {};
					returnJson[satname].azimuth = azimuth;
					returnJson[satname].elevation = elevation;
				}				
			}
			res.send(returnJson);
		}).catch(error => {
			console.error(error)
			res.send({ "error":"error"});
		});
	}	
	
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});