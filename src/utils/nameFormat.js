function formatUserName(aItem, aPrefix) {
    let userObj;

    if (aItem.id) {
        userObj = {
            user_name: aItem.username,
            user_first_name: aItem.first_name,
            user_last_name: aItem.last_name
        }
    } else {
        userObj = {
            user_name: aItem.user_name,
            user_first_name: aItem.user_first_name,
            user_last_name: aItem.user_last_name
        }
    }

    if (!userObj.user_name && !userObj.user_first_name) return '';
    let mUserName = userObj.user_name;
    if (mUserName) {
        if (aPrefix) {
            mUserName = aPrefix + mUserName;
        }
    } else {
        mUserName = userObj.user_first_name;
        if (userObj.user_last_name ) {
            mUserName += ' ' + userObj.user_last_name;
        }
    }
    return mUserName;
}

function formatUserMention(aItem) {
    let name;
    if (aItem.user_first_name) {
        name = aItem.user_first_name;
        if (aItem.user_last_name) {
            name += ' ' + aItem.user_last_name;
        }
    } else {
        name = aItem.user_name;
    }
    return '<a href="tg://user?id=' + aItem.user_id + '">' + name + '</a>';
}

module.exports = {
    formatUserName,
    formatUserMention
};
