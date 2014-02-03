var habitBaseUrl = 'https://beta.habitrpg.com/api/v2';
var challengeId = '21cbd8b0-623e-40d4-967b-89aea725c11d';
var defaultText = ['Pull requests, issues, and commits count. Don\'t just make trivial (whitespace, comments) edits though.'];

var startDate = new Date(2014, 0, 3); // why the fuck is the month zero indexed?
var endDate = new Date(2014, 1, 4);
var users;

var ghOverride = {
    Fandekasp: "Fandekasp",
    mpmiszczyk: "mpmiszczyk",
    Malharhak:"Malharhak",
    "Elektro Korobase": "Elektro121",
    redwire: "redwire",
    thisisboris:"thisisboris",
    Cole: "colegleason",
    Melevir: "Melevir",
    hopefulwebdev: "zkay"
};

function loadData(auth, root) {
    // we need the list of members participating in the challenge
    fetchChallenge(challengeId, function(challenge) {
        challenge.members.forEach(function(member) {
            var element = $('<tr>', {class: 'member', id: member._id}).appendTo(root);
            $('<td>', {text: member.profile.name}).appendTo(element);
            // they store their Github usernames in the 'Extra Notes' section of
            // the challenge's daily task
            fetchMemberProgress(member, auth, function(progress) {
                var ghUsername = progress.dailys[0].notes;
                // There is some default text in the daily, so ignore if they
                // didn't change it'
                if (defaultText.indexOf(ghUsername) < 0) {
                    var td = $('<td>').appendTo(element);
                    $('<a>', {
                        text: ghUsername,
                        href:'https://github.com/' + ghUsername
                    }).appendTo(td);
                    // Get their Github contribution history
                    fetchGithubContribs(ghUsername, function(data) {
                        // parse that data into a format the heatmap can use
                        var formatted = parseGithubData(data, startDate, endDate);
                        // add total cell
                        $('<td>', {text: formatted.total}).appendTo(element);
                        // add days cell
                        $('<td>', {text: formatted.days}).appendTo(element);
                        // add Streak cell
                        $('<td>', {text: formatted.streak}).appendTo(element);
                        // add Score cell
                        $('<td>', {text: score(formatted).toFixed(1), class: 'score'}).appendTo(element);
                        // create the heatmap and append it to the DOM
                        makeHeatMap(formatted.heatmap, $('<td>').appendTo(element)[0]);
                        sortMembers();
                    });
                } else {
                    // They haven't given us a username, so display an error
                    $('<td>', {
                        text: 'Github username not found!',
                        title: 'Put your Github username in the \'Extra Notes\' section of the daily associated with this challenge'
                    }).appendTo(element);
                }
            });
        });
    });
}

function fetchChallenge(id, callback) {
    $.getJSON(habitBaseUrl + '/challenges/' + id, {}, function(challenge) {
        defaultText.push(challenge.dailys[0].notes);
        callback(challenge);
    });;
}

function fetchMemberProgress(member, auth, callback) {
    if (ghOverride[member.profile.name])
        return callback({ dailys: [{notes:ghOverride[member.profile.name]}]});
    var url = habitBaseUrl + '/challenges/'+ challengeId + '/member/' + member._id;
    $.ajax(url, {
        headers: {
            'x-api-user': auth.user,
            'x-api-key': auth.key
        },
        success: callback
    });
}

function parseGithubData(data, startDate, endDate) {
    if (data.query.results) {
        var formatted = {heatmap: {}, streak: 0, total: 0, days:0};
        // oh YQL, why do you torture me so?
        data = data.query.results.json.json;
        data.forEach(function(day) {
            day = day.json;
            var time = Date.parse(day[0]);
            var value = parseInt(day[1]);
            if (startDate.getTime() <= time && time <= endDate.getTime()) {
                formatted.streak = (value > 0) ? formatted.streak + 1 : 0;
                formatted.days += (value > 0) ? 1 : 0;
                formatted.total += value;
                formatted.heatmap[(time/1000).toString()] = parseInt(day[1]);
            }
        });
        return formatted;
    } else {
        return null;;
    }
}

function makeHeatMap(data, element) {
    var cal = new CalHeatMap();
    cal.init({
        data: data,
        displayLegend: false,
        range: 2,
        legend: [1, 3, 5, 10],
        highlight: [startDate, 'now', endDate],
        domain: 'month',
        subDomain: 'day',
        itemSelector: element,
        start: startDate
    });
    return cal;
}

function fetchGithubContribs(username, callback) {
    window['YQL' + username] = function(data) {
        callback(data);
    };

    $.ajax("http://query.yahooapis.com/v1/public/yql", {
        data: {
            q: 'select * from json where url=\"https://github.com/users/' + username + '/contributions_calendar_data\"',
            format: 'json',
            jsoncompat: 'new'
        },
        dataType: 'jsonp',
        jsonpCallback: 'YQL' + username

    });
};


function supports_html5_storage() {
    try {
        return 'localStorage' in window && window['localStorage'] !== null;
    } catch (e) {
        return false;
    }
}

function loadAuthFromStorage() {
    var user = localStorage['habitrpg.api.user'];
    var key =localStorage['habitrpg.api.key'];
    if (key && user) {
        return {key:key,user:user};
    } else {
        return null;
    }
}

function score(contribs) {
    return contribs.days + (contribs.streak * 0.3) + (contribs.total * 0.05);
}

function sortMembers() {
    var rows = $('#members tr.member').toArray();
    var sorted = rows.sort(function(a, b) {
        var scoreA = $(a).children('.score').first().text() || -1;
        var scoreB = $(b).children('.score').first().text() || -1;
        return parseFloat(scoreB) - parseFloat(scoreA);
    });
    $('#members').append(sorted);
}
