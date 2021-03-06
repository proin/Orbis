exports.session_path = __home + '/session';

exports.start = function (server, callback) {
    if (require('fs').existsSync(exports.session_path) == false)
        require('fs').mkdirSync(exports.session_path);

    var conf = server.vhost.middleware;
    if (!conf.session) conf.session = {};
    if (!conf.session.expired) conf.session.expired = '1w';
    if (typeof conf.session.expired == 'string') {
        conf.session.expired = conf.session.expired.replace('s', '*1000*');
        conf.session.expired = conf.session.expired.replace('m', '*60*1000*');
        conf.session.expired = conf.session.expired.replace('h', '*60*60*1000*');
        conf.session.expired = conf.session.expired.replace('d', '*24*60*60*1000*');
        conf.session.expired = conf.session.expired.replace('w', '*7*24*60*60*1000*');
        if (!conf.session.host) conf.session.host = server.hostname;

        var tmp = conf.session.expired.split('*');
        conf.session.expired = 1;
        for (var i = 0; i < tmp.length; i++)
            conf.session.expired *= (tmp[i].length > 0 ? tmp[i] : '1');
    }

    var cookies = server.cookies;
    var uuid = cookies.uuid;
    var session = checkUUID(server);
    var sessionFilePath = exports.session_path + '/' + uuid + ".json";
    session.set = function (key, val) {
        session.storage[key] = val;
        require('fs').writeFileSync(
            sessionFilePath,
            JSON.stringify(session)
        );
    };

    session.get = function (key) {
        return session.storage[key];
    };

    session.del = function (key) {
        delete session.storage[key];
        require('fs').writeFileSync(sessionFilePath, JSON.stringify(session));
    };

    callback(session);
}

var checkUUID = function (server) {
    var sessionInfo = {}
    var sessionhost = '';
    if (server.vhost.middleware.session.host) sessionhost = server.vhost.middleware.session.host;
    else sessionhost = server.hostname;

    var preUUID = server.cookies.uuid;
    if (preUUID != null && require('fs').existsSync(exports.session_path + '/' + preUUID + '.json')) {
        sessionInfo = JSON.parse(require('fs').readFileSync(exports.session_path + '/' + preUUID + '.json'));
        if (sessionInfo.host == sessionhost) {
            var sessionDate = new Date(sessionInfo.date);
            var now = new Date();
            var diff = now - sessionDate;

            if (diff < server.vhost.middleware.session.expired) {
                sessionInfo.date = new Date().toString();
                require('fs').writeFileSync(exports.session_path + '/' + preUUID + '.json', JSON.stringify(sessionInfo));
                return JSON.parse(require('fs').readFileSync(exports.session_path + '/' + preUUID + '.json'));
            } else {
                require('fs').unlinkSync(exports.session_path + '/' + preUUID + '.json', JSON.stringify(sessionInfo));
            }
        }
    }

    var uuid = require('node-uuid').v4();
    while (require('fs').existsSync(exports.session_path + '/' + uuid + '.json') == true)
        uuid = require('node-uuid').v4();
    sessionInfo.uuid = uuid;
    sessionInfo.host = sessionhost;
    sessionInfo.port = server.port;
    sessionInfo.date = new Date().toString();
    sessionInfo.expired = server.vhost.middleware.session.expired;
    sessionInfo.storage = {};

    require('fs').writeFileSync(exports.session_path + '/' + uuid + '.json', JSON.stringify(sessionInfo));
    server.response.setHeader("Set-Cookie", ['uuid=' + uuid + '; Domain=' + sessionInfo.host + '; Path=/']);
    return sessionInfo;
}