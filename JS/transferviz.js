var map = L.map('map').setView([50.85, 12.50], 5);

// Add OpenStreetMap tiles to the map
L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Define global variables
let playerData;
let clubData;
let seasonsData;
let markerGroup = L.featureGroup().addTo(map);
let selectedSeason;
let selectedView;


// DOM Creation View Select Buttons
let btnJoined = d3.select('#btnJoined');
let btnLeft = d3.select('#btnLeft');

btnJoined.on('click', function() {
    selectedView = "joined";
    styleViewButton(selectedView);
    updateMap(selectedSeason, selectedView);
});

btnLeft.on('click', function() {
    selectedView = "left";
    styleViewButton(selectedView);
    updateMap(selectedSeason, selectedView);
});

function styleViewButton(view) {
    if (view === "joined") {
        btnLeft.attr("class", "btn btn-secondary");
        btnJoined.attr("class", "btn btn-primary");
    } else if (view === "left") {
        btnLeft.attr("class", "btn btn-primary");
        btnJoined.attr("class", "btn btn-secondary");
    } else {
        btnLeft.attr("class", "btn btn-secondary");
        btnJoined.attr("class", "btn btn-secondary");
    }
}

// Load the Data from multiple files
Promise.all([
    d3.json('Data/transfers.json'),
    d3.json('Data/clubs.geojson'),
    d3.json('Data/seasons.json')
]).then(function([tData, cData, sData]) {
    playerData = tData;
    clubData = cData;
    seasonsData = sData;
    selectedSeason = seasonsData[seasonsData.length-2].season;
    selectedView = "left"; // left, joined, playerID

    // Reverse the coordinates for each feature in clubData because leaflet uses [lat,lon] instead of [lon,lat] in geojson
    clubData.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates.reverse();
        }
    });
    
    updateMap(selectedSeason, selectedView);
}).catch(function(error) {
    console.log(error);
});

// Define a function to update the map based on the selected season and view
function updateMap(selectedSeason, selectedView) {
    // Clear existing markers from the markerGroup
    markerGroup.clearLayers();

    const seasonData = seasonsData.filter(d => d.season == selectedSeason)[0];
    let transferList = [];  // to store the clubId along with the player details

    if (selectedView === "left" || selectedView === "joined") {
        const players = seasonData["players_"+selectedView]
        for (let player of players) {
            const transfer = player.player_transfer_history.find(d => d.season == selectedSeason && d["team_"+selectedView+"_TM_id"] === "452");
            transferList.push({transferDetail: transfer, player: player});
        }
    } else {
        // In this case selectedView is the player name
        const player = playerData.find(d => d.player_name == selectedView);
        for (let transfer of player.player_transfer_history) {
            // only show transfer arrow if club is in the clubData
            if (clubData.features.find(feature => feature.properties.id === transfer.team_left_TM_id) && 
                        clubData.features.find(feature => feature.properties.id === transfer.team_joined_TM_id)) {
                transferList.push({transferDetail: transfer, player: player});
            }
        }
    }
    // Create a set of clubIds from transferDetails
    let clubIdsSet = new Set();
    transferList.forEach(transfer => {
        clubIdsSet.add(transfer.transferDetail.team_left_TM_id);
        clubIdsSet.add(transfer.transferDetail.team_joined_TM_id);
    });
    // Add markers for clubs
    // Filter the clubData based on the extracted club ids and add each to the markerGroup
    clubData.features.forEach(function(clubFeature) {
        if (clubIdsSet.has(clubFeature.properties.id)) {
            createIconMarker(clubFeature, clubFeature.geometry.coordinates);
        }
    });
    // Number of transfers
    let transferListLength = transferList.length;
    // Create arrows with player details
    transferList.forEach((transfer, index) => {createTransferArrow(transfer, transferListLength, index)});
}

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

    L.marker(latlng, {icon: clubIcon, zIndexOffset: players})
        .addTo(markerGroup)
        .bindPopup("Club Info: " + feature.properties.name)  // Bind a popup
        .on('mouseover', function() {
            // Open the popup when marker is hovered
            this.openPopup();
        })
        .on('mouseout', function() {
            // Close the popup when mouse is moved away
            this.closePopup();
        })
        .on('click', function() {
            // Handle click event here
            
        });
}

// // This function creates an arrow (line) between two sets of coordinates
function createTransferArrow(transfer, transferListLength, index) {
    // Define coordinates
    const clubFeatureTo = clubData.features.find(feature => feature.properties.id === transfer.transferDetail.team_joined_TM_id);
    const clubFeatureFrom = clubData.features.find(feature => feature.properties.id === transfer.transferDetail.team_left_TM_id);
    
    // Colors for arrow body between light grey and black
    let arrowColor = (selectedView === "left" || selectedView === "joined") 
    ? '#000000' 
    : d3.scaleLinear()
        .domain([0, transferListLength])
        .range(['#000000', '#d9d9d9'])(index); 

    // Define the path options (color, weight etc.) based on your requirements
    let pathOptions = {
        color: arrowColor,
        weight: 3,
        stoke: true
        // ... add any other styling options here
    };
    let arrow = L.polyline([clubFeatureFrom.geometry.coordinates, clubFeatureTo.geometry.coordinates], pathOptions);
    markerGroup.addLayer(arrow);
    
    // Colors for arrow head between light green and green
    let arrowHeadColorLoan = (selectedView === "left" || selectedView === "joined")
    ? '#006d2c'
    : d3.scaleLinear()
        .domain([0, transferListLength])
        .range(['#006d2c', '#c7e9c0'])(index);
    // Colors for arrow head between light read and red
    let arrowHeadColorEndLoan = (selectedView === "left" || selectedView === "joined")
    ? '#a63603'
    : d3.scaleLinear()
        .domain([0, transferListLength])
        .range(['#a63603', '#fee6ce'])(index);

    
    const fee = transfer.transferDetail.transfer_fee;
    let arrowHeadColor = (fee === "Leihe" || fee.includes("Leihgebühr") ) ? arrowHeadColorLoan : (fee === "Leih-Ende") ? arrowHeadColorEndLoan : arrowColor;
    // Size of arrow head
    let pixelSize = (selectedView === "left" || selectedView === "joined") ? 15 : 15 - 10*index/transferListLength;
    // Plot arrow head
    let arrowHeadOptions = {
        color: arrowHeadColor,
        weight: 3,
        stoke: true
    };
    let arrowHead = L.polylineDecorator(arrow, {
        patterns: [{
            offset: '25%', // Place arrow at the end of the line
            repeat: '50%',
            symbol: L.Symbol.arrowHead({pixelSize: pixelSize, polygon: false, pathOptions: arrowHeadOptions})
        }]
    });
    markerGroup.addLayer(arrowHead);
    
    // Calculate midpoint coordinates
    let midPoint = getMidPoint(clubFeatureFrom.geometry.coordinates, clubFeatureTo.geometry.coordinates);

    // Define player
    const player = transfer.player;
    
    // Create a custom icon using the player's image link
    borderColor = 'green'
    let playerIcon = L.divIcon({
        html: `<div class="circular-icon-wrapper" style="background-image: url('${player.player_image_link}'); border-color: ${arrowColor};"></div>`,
        iconSize: [32, 32],
        className: ''
    });
    // Place the marker at the midpoint with the custom icon
    let playerMarker = L.marker(midPoint, { icon: playerIcon })
        .addTo(markerGroup)
        .bindPopup("Player Info: " + player.player_name)  // Bind a popup
        .on('mouseover', function() {
            // Open the popup when marker is hovered
            this.openPopup();
        })
        .on('mouseout', function() {
            // Close the popup when mouse is moved away
            this.closePopup();
        })
        .on('click', function() {
            // Handle click event here
            selectedView = player.player_name;
            styleViewButton(selectedView);
            updateMap(selectedSeason, selectedView);
        });
}

function getMidPoint(start, end) {
    // Convert lat-lon to pixel coordinates
    const p1 = map.project(start);
    const p2 = map.project(end);
    // Calculate pixel midpoint
    const pixelMidPoint = p1._add(p2)._divideBy(2);
    // Convert pixel midpoint back to lat-lon
    return map.unproject(pixelMidPoint);
}