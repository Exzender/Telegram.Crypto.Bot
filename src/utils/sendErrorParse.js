function parseSendMessageError(error) {
    const strError = error.toString();
    let res = '';
    if (strError.indexOf('blocked') !== -1) { // blocked by user
        res = "blocked";
    } else if (strError.indexOf('deactivated') !== -1) { // user deactivated
        res = "deactivated";
    } else if (strError.indexOf('initiate') !== -1) { // user not started chat
        res = "nochat";
    } else if (strError.indexOf('chat not found') !== -1) { // user not started chat
        res = "nochat";
    }
    return res;
}

module.exports = {
    parseSendMessageError
};
