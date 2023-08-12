var map = L.map('map').setView([50.85, 12.50], 4);

// Add OpenStreetMap tiles to the map
L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Define global variables
let transferData;
let clubData;
let seasonsData;
let markerGroup = L.featureGroup();
let ybCoordinates;

// Load the Data from multiple files
Promise.all([
    d3.json('../Data/transfers.json'),
    d3.json('../Data/clubs.geojson'),
    d3.json('../Data/seasons.json')
]).then(function([tData, cData, sData]) {
    transferData = tData;
    clubData = cData;
    seasonsData = sData;
    let selectedSeason = seasonsData[seasonsData.length-2].season;
    let selectedView = "left"; // left, joined, player
    
    // Get coordinates for club 452
    clubData.features.forEach(function(clubFeature) { if(clubFeature.properties.id === "452") {
        ybCoordinates = clubFeature.geometry.coordinates;
    }});
    
    updateMap(selectedSeason, selectedView);
    // // Add the data to the map
    // L.geoJSON(clubData, {
    //     pointToLayer: createIconMarker
    // }).addTo(map);
}).catch(function(error) {
    console.log(error);
});

// Define a function to create a custom icon marker for a club
function createIconMarker(feature, latlng) {
    
    // Assuming `#players` is a numeric property on `feature.properties`
    var players = feature.properties['players'];
    // Create a scaling factor based on the number of players
    var scale = Math.min(0.5 + 0.5 * players / 10, 1);
    // Calculate the icon size based on the scale
    var iconSize = [38 * scale, 38 * scale];
    
    var clubIcon = L.icon({
        iconUrl: 'https://tmssl.akamaized.net/images/wappen/head/'+feature.properties.id+'.png',
        iconSize: iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2], // Recalculate anchor based on the new size
        //popupAnchor: [-3, -76] // point from which the popup should open relative to the iconAnchor
    });

    return L.marker(latlng, {icon: clubIcon, zIndexOffset: players});
}

function updateMap(selectedSeason, selectedView) {
    // Clear existing markers from the markerGroup
    markerGroup.clearLayers();

    if (selectedView == "left") {
        let players = seasonsData.filter(function(d) { return d.season == selectedSeason; })[0].players_left;

        // Extract the club ids
        let clubIds = players.map(function(d) {
            return d.player_transfer_history.filter(function(d) {
                return d.season == selectedSeason && d.team_left_TM_id === "452";
            })[0].team_joined_TM_id;
        });
        clubIds.push("452");

        // Add the club markers
        addClubMarker(clubIds);

        // Now, create arrows from 452 to other markers
        clubData.features.forEach(function(clubFeature) {
            if (clubIds.includes(clubFeature.properties.id) && clubFeature.properties.id !== "452") {
                createArrow(ybCoordinates, clubFeature.geometry.coordinates);
            }
        });
    } else if (selectedView == "joined") {
        let players = seasonsData.filter(function(d) { return d.season == selectedSeason; })[0].players_joined;
        // Extract the club ids
        let clubIds = players.map(function(d) {
            return d.player_transfer_history.filter(function(d) {
                return d.season == selectedSeason && d.team_joined_TM_id === "452";
            })[0].team_left_TM_id;
        });
        clubIds.push("452");

        // Add the club markers
        addClubMarker(clubIds);

        // Now, create arrows from 452 to other markers
        clubData.features.forEach(function(clubFeature) {
            if (clubIds.includes(clubFeature.properties.id) && clubFeature.properties.id !== "452") {
                createArrow(clubFeature.geometry.coordinates, ybCoordinates);
            }
    });
}

    // Add markerGroup to the map if it's not already added
    if (!map.hasLayer(markerGroup)) {
        markerGroup.addTo(map);
    }
}

function addClubMarker(clubIds) {
    // Filter the clubData based on the extracted club ids and add each to the markerGroup
    clubData.features.forEach(function(clubFeature) {
        if (clubIds.includes(clubFeature.properties.id)) {
            let marker = createIconMarker(clubFeature, clubFeature.geometry.coordinates.reverse());
            markerGroup.addLayer(marker);
        }
    });
}

// This function creates an arrow (line) between two sets of coordinates
function createArrow(fromCoords, toCoords) {
    // Define the path options (color, weight etc.) based on your requirements
    let pathOptions = {
        color: 'black',
        weight: 2,
        stoke: true
        // ... add any other styling options here
    };

    let arrow = L.polyline([fromCoords, toCoords], pathOptions);
    markerGroup.addLayer(arrow);
    let arrowHead = L.polylineDecorator(arrow, {
        patterns: [{
            offset: '50%', // Place arrow at the end of the line
            repeat: 0,
            symbol: L.Symbol.arrowHead({pixelSize: 10, polygon: false, pathOptions: pathOptions})
        }]
    });
    markerGroup.addLayer(arrowHead);
}