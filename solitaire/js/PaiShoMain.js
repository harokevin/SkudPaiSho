// Pai Sho Main

var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);

  if (query.length > 0 && !(query.includes("game=") 
  							|| query.includes("accents=")
  							|| query.includes("doubleTiles="))) {
  	// Decompress first
  	// debug("Decompressing: " + query);
  	query = LZString.decompressFromEncodedURIComponent(query);
  	// debug("Result: " + query);
  }

  var vars = query.split("&");
  if (query.includes("&amp;")) {
  	vars = query.split("&amp;");
  }
  for (var i=0;i<vars.length;i++) {
  	var pair = vars[i].split("=");
        // If first entry with this name
        if (typeof query_string[pair[0]] === "undefined") {
        	query_string[pair[0]] = decodeURIComponent(pair[1]);
        // If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
    	var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
    	query_string[pair[0]] = arr;
        // If third or later entry with this name
    } else {
    	query_string[pair[0]].push(decodeURIComponent(pair[1]));
    }
} 
return query_string;
}();

/* Can save user email to "save games" - send self direct link to point in game. */
localEmailKey = "localUserEmail";

/* Handle tile design the same as main Skud Pai Sho. */
tileDesignTypeKey = "tileDesignTypeKey";

var url;

var theGame;
var gameNotation;
var notationBuilder;
var beginPhaseData;
var defaultHelpMessageText;
var defaultEmailMessageText;

var localStorage;

var drawnTile;
var lastDrawnTile; // Save for Undo

// var hostAccentTiles = [];
// var guestAccentTiles = [];

// var hostEmail;
// var guestEmail;

var BRAND_NEW = "Brand New";
var WAITING_FOR_ENDPOINT = "Waiting for endpoint";
// var READY_FOR_BONUS = "READY_FOR_BONUS";
// var WAITING_FOR_BONUS_ENDPOINT = "WAITING_FOR_BONUS_ENDPOINT";
// var WAITING_FOR_BOAT_BONUS_POINT = "WAITING_FOR_BOAT_BONUS_POINT";

// var HOST_SELECT_ACCENTS = "HOST_SELECT_ACCENTS";

var localPlayerRole = HOST;

var sandboxUrl;
var metadata = new Object();

window.requestAnimationFrame(function () {
	localStorage = new LocalStorage().storage;

	if (!localStorage.getItem(tileDesignTypeKey)) {
		useHLoweTiles = true;
	} else if (localStorage.getItem(tileDesignTypeKey) === "hlowe") {
		useHLoweTiles = true;
	} else {
		useHLoweTiles = false;
	}

	url = window.location.href.split('?')[0];
	sandboxUrl = url;

	// if (url.includes("calebhugo.com")) {
	// 	url = "http://skudpaisho.com/";
	// }

	theGame = new GameManager();

	// Handle options or set default values
	if (QueryString.accents === 'n') {
		includeAccentTiles = false;
	} else {
		includeAccentTiles = true;
	}

	if (QueryString.doubleTiles === 'y') {
		doubleTiles = true;
	} else {
		doubleTiles = false;
	}

	// Load metadata
	metadata.startDate = QueryString.sDate;
	metadata.endDate = QueryString.eDate;
	metadata.tournamentName = QueryString.tournamentName;
	metadata.tournamentHost = QueryString.tournamentHost;
	metadata.tournamentMatchNotes = QueryString.tournamentMatchNotes;
	// --- //

	gameNotation = new GameNotation();
	gameNotation.setNotationText(QueryString.game);

	hostEmail = QueryString.host;
	guestEmail = QueryString.guest;

	// if (gameNotation.moves.length > 1) {
		document.getElementById("replayControls").classList.remove("gone");
	// }

	refreshNotationDisplay();

	notationBuilder = new NotationBuilder();

	rerunAll();

	drawRandomTile();

	defaultEmailMessageText = document.querySelector(".footer").innerHTML;

	var localUserEmail = localStorage.getItem(localEmailKey);

	localPlayerRole = getCurrentPlayer();

	if (localUserEmail) {
		if (localPlayerRole === HOST && !QueryString.host) {
			hostEmail = localUserEmail;
		} else if (localPlayerRole === GUEST && !QueryString.guest) {
			guestEmail = localUserEmail;
		}
	} else {
		if (localPlayerRole === HOST) {
			hostEmail = null;
		} else if (localPlayerRole === GUEST) {
			guestEmail = null;
		}
	}

	updateFooter();

	defaultHelpMessageText = document.querySelector(".helpText").innerHTML;

	clearMessage();
});

function setUseHLoweTiles() {
	localStorage.setItem(tileDesignTypeKey, "hlowe");
	useHLoweTiles = true;
	theGame.actuate();
}

function setUseStandardTiles() {
	localStorage.setItem(tileDesignTypeKey, "standard");
	useHLoweTiles = false;
	theGame.actuate();
}

function toggleTileDesigns() {
	if (useHLoweTiles) {
		setUseStandardTiles();
	} else {
		setUseHLoweTiles();
	}
}

function promptEmail() {
	var ans = prompt("Please enter your email address:");

	if (ans) {
		ans = ans.trim();
		localStorage.setItem(localEmailKey, ans);
	}
	
	updateFooter();
	clearMessage();
}

function updateFooter() {
	var userEmail = localStorage.getItem(localEmailKey);
	if (userEmail && userEmail.includes("@") && userEmail.includes(".")) {
		document.querySelector(".footer").innerHTML = gamePlayersMessage() + "You are playing as " + userEmail
		+ " | <span class='skipBonus' onclick='promptEmail();'>Edit email</span> | <span class='skipBonus' onclick='forgetEmail();'>Forget email</span>";
		if (userEmail === "skudpaisho@gmail.com") {
			document.querySelector(".footer").innerHTML += "<br /><span class='skipBonus' onclick='getPublicTournamentLink();'>GetLink</span>";
		}
	} else {
		document.querySelector(".footer").innerHTML = gamePlayersMessage() + defaultEmailMessageText;
	}
}

function gamePlayersMessage() {
	if (!hostEmail && !guestEmail) {
		return "";
	}
	var msg = "";
	if (hostEmail) {
		msg += "HOST: " + hostEmail + "<br />";
	}
	if (guestEmail) {
		msg += "GUEST: " + guestEmail + "<br />";
	}
	msg += "<br />";
	return msg;
}

function forgetEmail() {
	var ok = confirm("Forgetting your email will disable email notifications. Are you sure?");
	if (!ok) {
		updateFooter();
		return;
	}

	if (localPlayerRole === HOST) {
		hostEmail = null;
	} else if (localPlayerRole === GUEST) {
		guestEmail = null;
	}

	localStorage.removeItem(localEmailKey);

	updateFooter();
	clearMessage();
}

function inputNow() {
	gameNotation.addNotationLine(document.getElementById("notationInput").value);

	refreshNotationDisplay();
}

function refreshNotationDisplay() {
	document.getElementById("notationText").innerHTML = gameNotation.getNotationHtml();
}

var currentMoveIndex = 0;

function rewindAllMoves() {
	pauseRun();
	theGame = new GameManager();
	notationBuilder = new NotationBuilder();
	currentMoveIndex = 0;
	refreshMessage();
}

function playNextMove(withActuate) {
	if (currentMoveIndex >= gameNotation.moves.length) {
		// no more moves to run
		refreshMessage();
		return false;
	} else {
		theGame.runNotationMove(gameNotation.moves[currentMoveIndex], withActuate);
		currentMoveIndex++;
		return true;
	}
}

function playPrevMove() {
	pauseRun();

	var moveToPlayTo = currentMoveIndex - 1;

	theGame = new GameManager();

	notationBuilder = new NotationBuilder();

	currentMoveIndex = 0;

	while (currentMoveIndex < moveToPlayTo) {
		playNextMove(true);
	}

	refreshMessage();
}

function playAllMoves() {
	pauseRun();
	while (playNextMove(false)) {
		// Nothing!
	}
	theGame.actuate();
}

var interval = 0;
var replayIntervalLength = 800;

function playPause() {
	if (gameNotation.moves.length === 0) {
		return;
	}
	if (interval === 0) {
		// Play
		document.querySelector(".playPauseButton").value = "||";
		if (playNextMove(true)) {
			interval = setInterval(function() {
				if (!playNextMove(true)) {
					pauseRun();
				}
			}, replayIntervalLength);//800);
} else {
			// All done.. restart!
			rewindAllMoves();
			playPause();
		}
	} else {
		pauseRun();
	}
}

function pauseRun() {
	clearInterval(interval);
	interval = 0;
	document.querySelector(".playPauseButton").value = ">";
}

function getAdditionalMessage() {
	var msg = "";//"<br />";

	// if (theGame.getWinner()) {
		msg += "<br /><strong>" + theGame.getWinReason() + "</strong>";
	// }
	return msg;
}

function refreshMessage() {
	document.querySelector(".gameMessage").innerHTML = getAdditionalMessage();
}

function rerunAll() {
	theGame = new GameManager();
	
	notationBuilder = new NotationBuilder();

	currentMoveIndex = 0;

	playAllMoves();

	refreshMessage();
}

function finalizeMove(ignoreNoEmail) {
	rerunAll();

	// var linkUrl = url + "?";
	var linkUrl = "";
	if (hostEmail) {
		linkUrl += "host=" + hostEmail + "&";
	}
	if (guestEmail) {
		linkUrl += "guest=" + guestEmail + "&";
	}
	linkUrl += "game=" + gameNotation.notationTextForUrl();

	// Add additional parameters
	if (includeAccentTiles) {
		linkUrl += "&accents=y";
	} else {
		linkUrl += "&accents=n";
	}

	if (doubleTiles) {
		linkUrl += "&doubleTiles=y";
	} else {
		linkUrl += "&doubleTiles=n";
	}

	// Add start date
	if (!metadata.startDate) {
		metadata.startDate = getDateString();
	}
	linkUrl += "&sDate=" + metadata.startDate;

	// Add tournament info
	if (metadata.tournamentName && metadata.tournamentHost) {
		linkUrl += "&tournamentName=" + metadata.tournamentName;
		linkUrl += "&tournamentHost=" + metadata.tournamentHost;
		linkUrl += "&tournamentMatchNotes=" + metadata.tournamentMatchNotes;
	}

	//if (theGame.board.winners.length > 0) {
	if (theGame.getWinner()) {
		// Add end date
		if (!metadata.endDate) {
			metadata.endDate = getDateString();
		}
		linkUrl += "&eDate=" + metadata.endDate;
	}

	// debug(url + "?" + linkUrl);
	// Compress, then build full URL
	linkUrl = LZString.compressToEncodedURIComponent(linkUrl);

	linkUrl = url + "?" + linkUrl;

	// if (theGame.board.winners.length > 0) {
	if (theGame.getWinner()) {
		// Call short url because game is over
		if (!url.startsWith("file")) {
			getShortUrl(linkUrl);
		}
	}

	// debug("End result: " + linkUrl);

	// if (!url.startsWith("file") && !haveBothEmails()) {
	// 	getShortUrl(linkUrl, linkShortenCallback);
	// } else {
	// 	linkShortenCallback(linkUrl);//.replace(/\(/g, "%28").replace(/\)/g, "%29"));
	// }
	linkShortenCallback(linkUrl, ignoreNoEmail);
}

function showSubmitMoveForm(url) {
	// Move has completed, so need to send to "current player"
	var toEmail = getCurrentPlayerEmail();

	if (metadata.tournamentHost) {
		toEmail += ", " + metadata.tournamentHost;
	}
	
	var fromEmail = getUserEmail();

	var bodyMessage = getEmailBody(url);

	$('#fromEmail').attr("value", fromEmail);
	$('#toEmail').attr("value", toEmail);
	$('#message').attr("value", bodyMessage);
	$('#contactform').removeClass('gone');
}

function getNoUserEmailMessage() {
	return "Recommended: <span class='skipBonus' onclick='promptEmail(); finalizeMove();'>Enter your email address</span> to be notified when it is your turn. <br /><em><span class='skipBonus' onclick='finalizeMove(true);'>Click to ignore</span></em><br /><br />";
}

function linkShortenCallback(shortUrl, ignoreNoEmail) {
	debug(shortUrl);

	var messageText = "";

	messageText += getResetMoveText();
	messageText += "<br />";

	if (theGame.getWinner()) {
		messageText += "<a href=\"" + shortUrl + "\">Direct link to game</a>";
	}

	messageText += "<br /><strong>" + theGame.getWinReason() + "</strong>";

	document.querySelector(".gameMessage").innerHTML = messageText;
}

function haveBothEmails() {
	return hostEmail && guestEmail && haveUserEmail();
}

function haveUserEmail() {
	if (localStorage.getItem(localEmailKey)) {
		return true;
	}
	return false;
}

function getUserEmail() {
	return localStorage.getItem(localEmailKey);
}

function getCurrentPlayerEmail() {
	var address;
	if (getCurrentPlayer() === HOST) {
		address = hostEmail;
	} else if (getCurrentPlayer() === GUEST) {
		address = guestEmail;
	}
	return address;
}

function getOpponentPlayerEmail() {
	var address;
	if (getCurrentPlayer() === HOST) {
		address = guestEmail;
	} else if (getCurrentPlayer() === GUEST) {
		address = hostEmail;
	}
	return address;
}

function getEmailBody(url) {
	var bodyMessage = "I just made move #" + gameNotation.getLastMoveNumber() + " in Skud Pai Sho! Click here to open our game: " + url;

	if (metadata.tournamentName) {
		bodyMessage += "[BR][BR]This is a move submission for tournament: " + metadata.tournamentName;
		bodyMessage += "[BR]Match Info:[BR]" + metadata.tournamentMatchNotes;
	}
	
	bodyMessage += "[BR][BR]---- Full Details: ----[BR]Move: " + gameNotation.getLastMoveText() 
		+ "[BR][BR]Game Notation: [BR]" + gameNotation.getNotationForEmail();

	return bodyMessage;
}

function getCurrentPlayer() {
	if (gameNotation.moves.length <= 1) {
		if (gameNotation.moves.length === 0) {
			return HOST;
		} else {
			return GUEST;
		}
	}
	if (currentMoveIndex <= 2) {
		return GUEST;
	}
	var lastPlayer = gameNotation.moves[currentMoveIndex - 1].player;

	if (lastPlayer === HOST) {
		return GUEST;
	} else if (lastPlayer === GUEST) {
		return HOST;
	}
}

function showHarmonyBonusMessage() {
	document.querySelector(".gameMessage").innerHTML = "Harmony Bonus! Select a tile to play or <span class='skipBonus' onclick='skipHarmonyBonus();'>skip</span>."
	+ getResetMoveText();
}

function getResetMoveText() {
	return "<br /><br /><span class='skipBonus' onclick='undoMove();'>Undo move</span>";
}

function showResetMoveMessage() {
	document.querySelector(".gameMessage").innerHTML += getResetMoveText();
}

function undoMove() {
	// Remove last move
	gameNotation.removeLastMove();

	if (drawnTile) {
		theGame.tileManager.putTileBack(drawnTile);
	}

	drawnTile = lastDrawnTile;

	rerunAll();
	// $('#contactform').addClass('gone');
}

function myTurn() {
	// var userEmail = localStorage.getItem(localEmailKey);
	// if (userEmail && userEmail.includes("@") && userEmail.includes(".")) {
	// 	if (getCurrentPlayer() === HOST) {
	// 		return localStorage.getItem(localEmailKey) === hostEmail;
	// 	} else {
	// 		return localStorage.getItem(localEmailKey) === guestEmail;
	// 	}
	// } else {
	// 	return true;
	// }
	return true;
}

function unplayedTileClicked(tileDiv) {
	if (currentMoveIndex !== gameNotation.moves.length) {
		debug("Can only interact if all moves are played.");
		return;
	}

	var divName = tileDiv.getAttribute("name");	// Like: GW5 or HL
	var tileId = parseInt(tileDiv.getAttribute("id"));
	var playerCode = divName.charAt(0);
	var tileCode = divName.substring(1);

	var player = GUEST;
	if (playerCode === 'H') {
		player = HOST;
	}

	var tile = theGame.tileManager.peekTile(player, tileCode, tileId);

	if (notationBuilder.status === BRAND_NEW) {
		tile.selectedFromPile = true;

		notationBuilder.moveType = PLANTING;
		notationBuilder.plantedFlowerType = tileCode;
		notationBuilder.status = WAITING_FOR_ENDPOINT;

		theGame.setAllLegalPointsOpen(getCurrentPlayer(), tile);
	} else {
		theGame.hidePossibleMovePoints();
		notationBuilder = new NotationBuilder();
	}
}

function pointClicked(htmlPoint) {
	if (currentMoveIndex !== gameNotation.moves.length) {
		debug("Can only interact if all moves are played.");
		return;
	}

	var npText = htmlPoint.getAttribute("name");

	var notationPoint = new NotationPoint(npText);
	var rowCol = notationPoint.rowAndColumn;
	var boardPoint = theGame.board.cells[rowCol.row][rowCol.col];

	if (notationBuilder.status === BRAND_NEW) {
		if (boardPoint.hasTile()) {
			if (boardPoint.tile.ownerName !== getCurrentPlayer()) {
				debug("That's not your tile!");
				return;
			}

			if (boardPoint.tile.type === ACCENT_TILE) {
				return;
			}

			if (boardPoint.tile.trapped) {
				return;
			}

			if (!newKnotweedRules && boardPoint.tile.trapped) {
				return;
			}

			// Commented out because we're not supporting movement yet..
			// notationBuilder.status = WAITING_FOR_ENDPOINT;
			// notationBuilder.moveType = ARRANGING;
			// notationBuilder.startPoint = new NotationPoint(htmlPoint.getAttribute("name"));

			// theGame.revealPossibleMovePoints(boardPoint);
		}
	} else if (notationBuilder.status === WAITING_FOR_ENDPOINT) {
		if (boardPoint.isType(POSSIBLE_MOVE)) {
			// They're trying to move there! And they can! Exciting!
			// Need the notation!
			theGame.hidePossibleMovePoints();
			notationBuilder.endPoint = new NotationPoint(htmlPoint.getAttribute("name"));
			
			var move = gameNotation.getNotationMoveFromBuilder(notationBuilder);
			var bonusAllowed = theGame.runNotationMove(move);

			if (!bonusAllowed) {
				// Move all set. Add it to the notation!
				gameNotation.addMove(move);
				finalizeMove();
				drawRandomTile();
			}
		} else {
			theGame.hidePossibleMovePoints();
			notationBuilder = new NotationBuilder();
		}
	}
}

function drawRandomTile() {
	// if (!theGame.getWinner()) {
		lastDrawnTile = drawnTile;
		drawnTile = theGame.drawRandomTile();
	// }
}

function skipHarmonyBonus() {
	var move = gameNotation.getNotationMoveFromBuilder(notationBuilder);
	gameNotation.addMove(move);
	finalizeMove();
}


// This is from http://stackoverflow.com/questions/1771397/jquery-on-the-fly-url-shortener 
function getShortUrl(url, callback) {
	var accessToken = 'ebedc9186c2eecb1a28b3d6aca8a3ceacb6ece63';
	var url = 'https://api-ssl.bitly.com/v3/shorten?access_token=' + accessToken + '&longUrl=' + encodeURIComponent(url);

	$.getJSON(
		url,
		{},
		function(response) {
			debug(response.data.url);
			if(callback)
				callback(response.data.url);
		});
}

function clearMessage() {
	if (!defaultHelpMessageText) {
		defaultHelpMessageText = "<h4>Solitaire Pai Sho</h4> <p>Pai Sho is a game of harmony. The goal of Solitaire Pai Sho is to place Flower Tiles to create a balance of Harmony and Disharmony on the board.</p> <p>Each turn, you are given a tile that's been drawn for you to place on the board. When all the tiles have been played, the game ends and your score will be calculated.</p> <p><a href='https://skudpaisho.wordpress.com/pai-sho-resources/'>View the resources page</a> for the rules, a print and play Pai Sho set, and more!</p>";
	}
	document.querySelector(".helpText").innerHTML = defaultHelpMessageText;
	if (!haveUserEmail()) {
		document.querySelector(".helpText").innerHTML += "<p>If you <span class='skipBonus' onclick='promptEmail()'>enter your email address</span>, you can be notified when your opponent plays a move.</p>";
	}

	document.querySelector(".helpText").innerHTML = getTournamentText() 
		+ document.querySelector(".helpText").innerHTML
		+ getAltTilesOptionText();
}

function haveUserEmail() {
	var userEmail = localStorage.getItem(localEmailKey);
	return (userEmail && userEmail.includes("@") && userEmail.includes("."));
}

function showTileMessage(tileDiv) {
	var divName = tileDiv.getAttribute("name");	// Like: GW5 or HL
	var tileId = parseInt(tileDiv.getAttribute("id"));

	var tile = new Tile(divName.substring(1), divName.charAt(0));

	var message = [];

	var ownerName = HOST;
	if (divName.startsWith('G')) {
		ownerName = GUEST;
	}
	
	var tileCode = divName.substring(1);

	var heading = Tile.getTileName(tileCode);

	// message.push(tile.ownerName + "'s tile");

	addTileSummaryToMessageArr(message, tileCode);

	if (message.length > 1) {
		setMessage(toHeading(heading) + toBullets(message));
	} else {
		setMessage(toHeading(heading) + toMessage(message));
	}
}

function addTileSummaryToMessageArr(message, tileCode) {
	if (tileCode.length > 1) {
		var colorCode = tileCode.charAt(0);
		var tileNum = parseInt(tileCode.charAt(1));

		var harmTileNum = tileNum - 1;
		var harmTileColor = colorCode;
		if (harmTileNum < 3) {
			harmTileNum = 5;
			if (colorCode === 'R') {
				harmTileColor = 'W';
			} else {
				harmTileColor = 'R';
			}
		}

		var harmTile1 = Tile.getTileName(harmTileColor + harmTileNum);

		harmTileNum = tileNum + 1;
		harmTileColor = colorCode;
		if (harmTileNum > 5) {
			harmTileNum = 3;
			if (colorCode === 'R') {
				harmTileColor = 'W';
			} else {
				harmTileColor = 'R';
			}
		}

		var harmTile2 = Tile.getTileName(harmTileColor + harmTileNum);

		harmTileNum = tileNum;
		if (colorCode === 'R') {
			harmTileColor = 'W';
		} else {
			harmTileColor = 'R';
		}
		var clashTile = Tile.getTileName(harmTileColor + harmTileNum);

		// message.push("Basic Flower Tile");
		// message.push("Can move up to " + tileNum + " spaces");
		message.push("Forms Harmony with " + harmTile1 + ", " + harmTile2 + ", and the Lotus");
		message.push("Forms Disharmony with " + clashTile + " and the Orchid");
	} else {
		if (tileCode === 'R') {
			heading = "Accent Tile: Rock";
			if (simplest) {
				message.push("The Rock disrupts Harmonies and cannot be moved by a Wheel.");
			} else if (rocksUnwheelable) {
				if (simpleRocks) {
					message.push("The Rock blocks Harmonies and cannot be moved by a Wheel.");
				} else {
					message.push("The Rock cancels Harmonies on horizontal and vertical lines it lies on. A Rock cannot be moved by a Wheel.");
				}
			} else {
				message.push("The Rock cancels Harmonies on horizontal and vertical lines it lies on.");
			}
		} else if (tileCode === 'W') {
			heading = "Accent Tile: Wheel";
			if (rocksUnwheelable || simplest) {
				message.push("The Wheel rotates all surrounding tiles one space clockwise but cannot move a Rock (cannot move tiles off the board or onto or off of a Gate).");
			} else {
				message.push("The Wheel rotates all surrounding tiles one space clockwise (cannot move tiles off the board or onto or off of a Gate).");
			}
		} else if (tileCode === 'K') {
			heading = "Accent Tile: Knotweed";
			if (newKnotweedRules) {
				message.push("The Knotweed drains surrounding Flower Tiles so they are unable to form Harmony.");
			} else {
				message.push("The Knotweed drains surrounding Basic Flower Tiles so they are unable to move or form Harmony.");
			}
		} else if (tileCode === 'B') {
			heading = "Accent Tile: Boat";
			if (simplest || rocksUnwheelable) {
				message.push("The Boat moves a Flower Tile to a surrounding space or removes an Accent tile.");
			} else if (rocksUnwheelable) {
				message.push("The Boat moves a Flower Tile to a surrounding space or removes a Rock or Knotweed tile.");
			} else {
				message.push("The Boat moves a Flower Tile to a surrounding space or removes a Knotweed tile.");
			}
		} else if (tileCode === 'L') {
			heading = "Special Flower: White Lotus";
			// message.push("Can move up to 2 spaces");
			message.push("Forms Harmony with all Flower Tiles");
		} else if (tileCode === 'O') {
			heading = "Special Flower: Orchid";
			// message.push("Can move up to 6 spaces");
			// message.push("Traps opponent's surrounding Flower Tiles so they cannot move");
			message.push("Forms Disharmony will all Flower Tiles");
		}
	}
}

function showPointMessage(htmlPoint) {
	var npText = htmlPoint.getAttribute("name");

	var notationPoint = new NotationPoint(npText);
	var rowCol = notationPoint.rowAndColumn;
	var boardPoint = theGame.board.cells[rowCol.row][rowCol.col];

	var message = [];
	if (boardPoint.hasTile()) {
		message.push(toHeading(boardPoint.tile.getName()));
		// Specific tile message
		/**
		Rose
		* In Harmony with Chrysanthemum to the north
		* Trapped by Orchid
		*/
		// Get tile summary message and then Harmony summary
		addTileSummaryToMessageArr(message, boardPoint.tile.code);
		var tileHarmonies = theGame.board.harmonyManager.getHarmoniesWithThisTile(boardPoint.tile);
		if (tileHarmonies.length > 0) {
			var bullets = [];
			tileHarmonies.forEach(function(harmony) {
				var otherTile = harmony.getTileThatIsNotThisOne(boardPoint.tile);
				bullets.push(otherTile.getName() 
					+ " to the " + harmony.getDirectionForTile(boardPoint.tile));
			});
			message.push("<strong>Currently in Harmony with: </strong>" + toBullets(bullets));
		}
		tileHarmonies = theGame.board.harmonyManager.getClashesWithThisTile(boardPoint.tile);
		if (tileHarmonies.length > 0) {
			var bullets = [];
			tileHarmonies.forEach(function(harmony) {
				var otherTile = harmony.getTileThatIsNotThisOne(boardPoint.tile);
				bullets.push(otherTile.getName() 
					+ " to the " + harmony.getDirectionForTile(boardPoint.tile));
			});
			message.push("<strong>Currently in Disharmony with: </strong>" + toBullets(bullets));
		}

		// Drained? Trapped? Anything else? Commenting out for Solitaire
		// if (boardPoint.tile.drained) {
		// 	message.push("Currently <em>drained</em> by a Knotweed.");
		// }
		// if (boardPoint.tile.trapped) {
		// 	message.push("Currently <em>trapped</em> by an Orchid.")
		// }
	} else {
		if (boardPoint.isType(NEUTRAL)) {
			message.push(getNeutralPointMessage());
		} else if (boardPoint.isType(RED) && boardPoint.isType(WHITE)) {
			message.push(getRedWhitePointMessage());
		} else if (boardPoint.isType(RED)) {
			message.push(getRedPointMessage());
		} else if (boardPoint.isType(WHITE)) {
			message.push(getWhitePointMessage());
		} else if (boardPoint.isType(GATE)) {
			message.push(getNeutralPointMessage());
		}
	}

	setMessage(toMessage(message));
}

function setMessage(msg) {
	if (msg === document.querySelector(".helpText").innerHTML) {
		clearMessage();
	} else {
		document.querySelector(".helpText").innerHTML = getTournamentText() + msg + getAltTilesOptionText();
	}
}

function getAltTilesOptionText() {
	return "<p><span class='skipBonus' onclick='toggleTileDesigns();'>Click here</span> to switch between standard and modern tile designs.</p>";
}

function getTournamentText() {
	if (metadata.tournamentMatchNotes) {
		return metadata.tournamentName + "<br />" + metadata.tournamentMatchNotes + "<br />";
	}
	return "";
}

function toHeading(str) {
	return "<h4>" + str + "</h4>";
}

function toMessage(paragraphs) {
	var message = "";

	paragraphs.forEach(function(str) {
		message += "<p>" + str + "</p>";
	});

	return message;
}

function toBullets(paragraphs) {
	var message = "<ul>";

	paragraphs.forEach(function(str) {
		message += "<li>" + str + "</li>";
	});

	message += "</ul>";

	return message;
}

function getNeutralPointMessage() {
	var msg = "<h4>Neutral Point</h4>";
	msg += "<ul>";
	msg += "<li>This point is Neutral, so any tile can be placed here.</li>";
	msg += "<li>If a tile that is on a point touches a Neutral area of the board, that point is considered Neutral.</li>";
	msg += "</ul>";
	return msg;
}

function getRedPointMessage() {
	var msg = "<h4>Red Point</h4>";
	msg += "<p>This point is Red, so Basic White Flower Tiles are not allowed to be placed here.</p>";
	return msg;
}

function getWhitePointMessage() {
	var msg = "<h4>White Point</h4>";
	msg += "<p>This point is White, so Basic Red Flower Tiles are not allowed to be placed here.</p>";
	return msg;
}

function getRedWhitePointMessage() {
	var msg = "<h4>Red/White Point</h4>";
	msg += "<p>This point is both Red and White, so any tile is allowed to be placed here.</p>";
	return msg;
}

function getGatePointMessage() {
	var msg = "<h4>Gate</h4>";
	msg += '<p>This point is a Gate. When Flower Tiles are played, they are <em>Planted</em> in an open Gate.</p>';
	msg += '<p>Tiles in a Gate are considered <em>Growing</em>, and when they have moved out of the Gate, they are considered <em>Blooming</em>.</p>';
	return msg;
}

function getPublicTournamentLink() {
	hostEmail = null;
	guestEmail = null;
	getLink(false);
}

function getLink(forSandbox) {
	var notation = new GameNotation();
	for (var i = 0; i < currentMoveIndex; i++) {
		notation.addMove(gameNotation.moves[i]);
	}

	var linkUrl = "";

	if (forSandbox && getUserEmail()) {
		linkUrl += "host=" + getUserEmail() + "&";
		linkUrl += "guest=" + getUserEmail() + "&";
	}

	linkUrl += "game=" + notation.notationTextForUrl();
	
	// Add start date
	if (metadata.startDate) {
		linkUrl += "&sDate=" + metadata.startDate;
	}

	// Add tournament info
	if (!forSandbox && metadata.tournamentName && metadata.tournamentHost) {
		linkUrl += "&tournamentName=" + metadata.tournamentName;
		linkUrl += "&tournamentHost=" + metadata.tournamentHost;
		linkUrl += "&tournamentMatchNotes=" + metadata.tournamentMatchNotes;
	}

	//if (theGame.board.winners.length > 0) {
	if (theGame.getWinner()) {
		// Add end date
		if (metadata.endDate) {
			linkUrl += "&eDate=" + metadata.endDate;
		}
	}

	linkUrl = LZString.compressToEncodedURIComponent(linkUrl);

	linkUrl = sandboxUrl + "?" + linkUrl;

	//if (theGame.board.winners.length > 0) {
	if (theGame.getWinner()) {
		// Call short url because game is over
		if (!sandboxUrl.startsWith("file")) {
			getShortUrl(linkUrl);
		}
	}

	console.log(linkUrl);
	return linkUrl;
}

function setAiIndex(i) {
	QueryString.replay = "true";
	if (QueryString.replay === "true") {
		document.getElementById("replayControls").classList.remove("gone");
	}
	if (activeAi) {
		activeAi2 = aiList[i];
		activeAi2.setPlayer(getCurrentPlayer());
	} else {
		activeAi = aiList[i];
		activeAi.setPlayer(getCurrentPlayer());
	}
	playAiTurn();
	if (gameNotation.getPlayerMoveNum() === 1) {
		playAiTurn();
	}
	if (gameNotation.getPlayerMoveNum() === 1) {
		// Host auto-copies Guest's first Plant
		var hostMoveBuilder = notationBuilder.getFirstMoveForHost(gameNotation.moves[gameNotation.moves.length - 1].plantedFlowerType);
		gameNotation.addMove(gameNotation.getNotationMoveFromBuilder(hostMoveBuilder));
		finalizeMove();
	}
	if (gameNotation.getPlayerMoveNum() === 2 && getCurrentPlayer() === GUEST) {
		playAiTurn();
	}
}

function playAiTurn() {
	if (theGame.getWinner()) {
		return;
	}
	var theAi = activeAi;
	if (activeAi2) {
		if (activeAi2.player === getCurrentPlayer()) {
			theAi = activeAi2;
		}
	}

	var playerMoveNum = gameNotation.getPlayerMoveNum();

	if (playerMoveNum === 1 && getCurrentPlayer() === HOST) {
		// Auto mirror guest move
		// Host auto-copies Guest's first Plant
		var hostMoveBuilder = notationBuilder.getFirstMoveForHost(gameNotation.moves[gameNotation.moves.length - 1].plantedFlowerType);
		gameNotation.addMove(gameNotation.getNotationMoveFromBuilder(hostMoveBuilder));
		finalizeMove();
	} else if (playerMoveNum < 3) {
		var move = theAi.getMove(theGame.getCopy(), playerMoveNum);
		if (!move) {
			debug("No move given...");
			return;
		}
		gameNotation.addMove(move);
		finalizeMove();
	} else {
		setTimeout(function(){
			var move = theAi.getMove(theGame.getCopy(), playerMoveNum);
			if (!move) {
				debug("No move given...");
				return;
			}
			gameNotation.addMove(move);
			finalizeMove();
		}, 10);
	}

	/*var move = activeAi.getMove(theGame.getCopy(), playerMoveNum);
	if (!move) {
		debug("No move given...");
		return;
	}
	gameNotation.addMove(move);
	finalizeMove();*/
}

function sandboxFromMove() {
	var link = getLink(true);
	window.open(link);
}

function getDateString() {
	let date = new Date();
	date = date.toISOString().slice(0,10);
	return date;
}

function hostTournamentClicked() {
	//
}



