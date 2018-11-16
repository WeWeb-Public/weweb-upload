#! /usr/bin/env node

const inquirer = require('inquirer')
const axios = require('axios')
const fs = require('fs');
const path = require('path');

const server = 'http://localhost:3000/api/v1'
const userPrefPath = path.join(process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + 'Library/Preferences' : '/var/local'), 'weweb_upload/user_pref.json')


/*=============================================m_ÔÔ_m=============================================\
  ASK USER FOR CREDENTIALS
\================================================================================================*/
const askCredentials = function () {
    const questions = [
        {
            name: 'email',
            type: 'input',
            message: 'Enter your WeWeb e-mail address:',
            validate: function (value) {
                if (value.length) {
                    return true;
                } else {
                    return 'Please enter your e-mail address.';
                }
            }
        },
        {
            name: 'password',
            type: 'password',
            message: 'Enter your password:',
            validate: function (value) {
                if (value.length) {
                    return true;
                } else {
                    return 'Please enter your password.';
                }
            }
        }
    ];
    return inquirer.prompt(questions);
}

/*=============================================m_ÔÔ_m=============================================\
  WRITE USER PREFS TO A FILE
\================================================================================================*/
const writeUserPref = function (userPref) {

    try {
        userPref = userPref || {};
        userPref = JSON.stringify(userPref);

        fs.writeFileSync(userPrefPath, userPref, function (err) {
            if (err) {
                throw new Error();
            }
        });

        return true;
    }
    catch (e) {
        return false;
    }

}

/*=============================================m_ÔÔ_m=============================================\
  GET USER PREFS FROM FILE
\================================================================================================*/
const readUserPref = function () {

    try {
        let userPref = null

        userPref = fs.readFileSync(userPrefPath, 'utf8')
        userPref = JSON.parse(userPref)

        return userPref;
    }
    catch (e) {
        return {};
    }

}

/*=============================================m_ÔÔ_m=============================================\
  GET PACKAGE.JSON
\================================================================================================*/
const getPackageJson = function () {
    try {
        let packageJSON

        packageJSON = fs.readFileSync('./package.json', 'utf8')
        packageJSON = JSON.parse(packageJSON)

        if (!packageJSON.name) {
            console.log('Error : "name" not found in package.json.')
            return
        }

        if (!packageJSON.type) {
            console.log('Error : "type" not found in package.json.')
            return
        }

        return packageJSON;
    } catch (error) {
        console.log('Error : ./package.json not found or incorrect format.')
        return null
    }
}

/*=============================================m_ÔÔ_m=============================================\
  CHECK IF TOKEN IS VALID
\================================================================================================*/
const isTokenValid = async function (token) {
    try {
        let response = await axios({
            method: 'get',
            url: server + '/me',
            headers: { 'wwauthmanagertoken': 'auth ' + token },
        })

        if (response.data.id) {
            return true;
        }
    }
    catch (error) {
    }

    return false;
}

/*=============================================m_ÔÔ_m=============================================\
  GET TOKEN FROM CREDENTIALS
\================================================================================================*/
const getToken = async function (credentials) {
    let response
    try {
        response = await axios.post(server + '/auth/login', credentials)
    }
    catch (error) {
        return null
    }

    console.log('-- Credentials ok --')
    return response.data.token
}

/*=============================================m_ÔÔ_m=============================================\
  GET FILE
\================================================================================================*/
const getFile = function (path) {
    try {
        return new Buffer(fs.readFileSync(path, 'utf8'), 'utf-8')
    } catch (error) {
        return null
    }
}

/*=============================================m_ÔÔ_m=============================================\
  GET UPLOAD REQUEST URL
\================================================================================================*/
const getUploadRequestUrl = function (packageJson) {
    switch (packageJson.type) {
        case 'wwObject':
            return server + '/wwobjects/' + packageJson.name + '/request_upload'
            break;
        case 'section':
            return server + '/sectionbases/' + packageJson.name + '/request_upload'
            break;
        default:
            return null
            break;
    }
}

/*=============================================m_ÔÔ_m=============================================\
  REQUEST S3 UPLOAD
\================================================================================================*/
const requestS3Upload = async function (url, filename, userPref) {
    let options = {
        method: 'POST',
        headers: { 'wwauthmanagertoken': 'auth ' + userPref.token },
        url: url,
        data: {
            filename: filename
        }
    }

    try {
        let response = await axios(options);
        return response.data.uploadUrl
    }
    catch (error) {
        return null
    }
}

/*=============================================m_ÔÔ_m=============================================\
  UPLOAD TO S3
\================================================================================================*/
const uploadToS3 = async function (url, data) {
    try {
        await axios({
            method: 'PUT',
            url: url,
            headers: {
                "Accept": '*/*'
            },
            skipAuthorization: true,
            data: data,
        })
        return true
    } catch (error) {
        return false
    }
}



const run = async function () {



    let userPref
    let packageJson

    /*=============================================m_ÔÔ_m=============================================\
      GET OBJECT NAME FROM PACKAGE.JSON
    \================================================================================================*/
    packageJson = getPackageJson();

    console.log('-- Upload ' + packageJson.type + ' ' + packageJson.name + ' --')


    /*=============================================m_ÔÔ_m=============================================\
      GET USER PREF AND CHECK TOKEN IF AVAILABLE
    \================================================================================================*/
    userPref = readUserPref()
    if (userPref.token && !await isTokenValid(userPref.token)) {
        delete userPref.token
    }


    /*=============================================m_ÔÔ_m=============================================\
      PROMPT LOGIN
    \================================================================================================*/
    if (!userPref.token) {
        const credentials = await askCredentials()
        userPref.token = await getToken(credentials)
        if (!userPref.token) {
            console.log('Wrong email / password')
            return
        }
    }


    /*=============================================m_ÔÔ_m=============================================\
      SAVE USER PREF
    \================================================================================================*/
    writeUserPref(userPref);

    /*=============================================m_ÔÔ_m=============================================\
      GET FILES
    \================================================================================================*/
    //Get front.js
    let frontJS = getFile('./dist/front.js');
    if (!frontJS) {
        console.log('Error : ./dist/front.js not found. Please make sure you ran \'yarn build\' before')
        return
    }

    //Get manager.js
    let managerJS = getFile('./dist/manager.js');
    if (!managerJS) {
        console.log('Error : ./dist/manager.js not found. Please make sure you ran \'yarn build\' before')
        return
    }


    /*=============================================m_ÔÔ_m=============================================\
      GET S3 REQUEST URL
    \================================================================================================*/
    let url = getUploadRequestUrl(packageJson)
    if (!url) {
        console.log('Error : unknown object type.')
        return
    }


    /*=============================================m_ÔÔ_m=============================================\
      UPLOAD FRONT.JS
    \================================================================================================*/
    //Request S3 upload
    let uploadUrl = await requestS3Upload(url, 'front.js', userPref)
    if (!uploadUrl) {
        console.log('Error : An error occured')
        return
    }

    //Upload to S3
    if (!await uploadToS3(uploadUrl, frontJS)) {
        console.log('Error : Upload error.')
        return
    }

    console.log('-- font.js upload ok --')


    /*=============================================m_ÔÔ_m=============================================\
      UPLOAD MANAGER.JS
    \================================================================================================*/
    //Request S3 upload
    uploadUrl = await requestS3Upload(url, 'manager.js', userPref)
    if (!uploadUrl) {
        console.log('Error : An error occured')
        return
    }

    //Upload to S3
    if (!await uploadToS3(uploadUrl, managerJS)) {
        console.log('Error : Upload error.')
        return
    }

    console.log('-- manager.js upload ok --')


    /*=============================================m_ÔÔ_m=============================================\
      🎉 DONE 🎉
    \================================================================================================*/
    console.log('-- UPLOAD DONE --')

}


run();
