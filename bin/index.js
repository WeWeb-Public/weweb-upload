#! /usr/bin/env node

const inquirer = require('inquirer')
const axios = require('axios')
const fs = require('fs');


const server = 'http://localhost:3000/api/v1'

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

const run = async function () {

    let token
    let response
    let objectName
    let objectType

    /*=============================================m_ÔÔ_m=============================================\
      GET OBJECT NAME FROM PACKAGE.JSON
    \================================================================================================*/
    let packageJSON
    try {
        packageJSON = fs.readFileSync('./package.json', 'utf8')
        packageJSON = JSON.parse(packageJSON)
    } catch (error) {
        console.log('Error : ./package.json not found or incorrect format.')
        return
    }

    if (!packageJSON.name) {
        console.log('Error : "name" not found in package.json.')
        return
    }
    objectName = packageJSON.name

    if (!packageJSON.type) {
        console.log('Error : "type" not found in package.json.')
        return
    }
    objectType = packageJSON.type

    console.log('-- Upload ' + objectType + ' ' + objectName + ' --')

    /*=============================================m_ÔÔ_m=============================================\
      PROMPT LOGIN
    \================================================================================================*/
    const credentials = await askCredentials()

    try {
        response = await axios.post(server + '/auth/login', credentials)
        token = response.data.token
    }
    catch (error) {
        console.log('Wrong email / password')
    }
    console.log('-- Credentials ok --')


    /*=============================================m_ÔÔ_m=============================================\
      GET FILES
    \================================================================================================*/
    let frontJS
    try {
        frontJS = new Buffer(fs.readFileSync('./dist/front.js', 'utf8'), 'utf-8')
    } catch (error) {
        console.log('Error : ./dist/front.js not found. Please make sure you ran \'yarn build\' before')
        return
    }

    let managerJS
    try {
        managerJS = new Buffer(fs.readFileSync('./dist/manager.js', 'utf8'), 'utf-8')
    } catch (error) {
        console.log('Error : ./dist/manager.js not found. Please make sure you ran \'yarn build\' before')
        return
    }


    /*=============================================m_ÔÔ_m=============================================\
      REQUEST S3 UPLOAD FOR FRONT.JS
    \================================================================================================*/
    let objectVersionId
    let options = {
        method: 'POST',
        headers: { 'wwauthmanagertoken': 'auth ' + token },
        data: {
            filename: 'front.js'
        }
    }

    switch (objectType) {
        case 'wwObject':
            options.url = server + '/wwobjects/' + objectName + '/request_upload'
            break;
        case 'section':
            options.url = server + '/sectionbases/' + objectName + '/request_upload'
            break;
        default:
            console.log('Error : unknown object type.')
            return
            break;
    }

    let uploadUrl
    try {
        response = await axios(options);
        uploadUrl = response.data.uploadUrl
        objectVersionId = response.data.objectVersionId
    }
    catch (error) {
        console.log('Error : An error occured')
        return
    }


    /*=============================================m_ÔÔ_m=============================================\
      UPLOAD FRONT.JS TO S3
    \================================================================================================*/

    try {
        await axios({
            method: 'PUT',
            url: uploadUrl,
            headers: {
                "Accept": '*/*'
            },
            skipAuthorization: true,
            data: frontJS,
        })
    } catch (error) {
        console.log('Error : Upload error.', error)
        return
    }

    console.log('-- font.js upload ok --')


    /*=============================================m_ÔÔ_m=============================================\
      REQUEST S3 UPLOAD FOR MANAGER.JS
    \================================================================================================*/
    options = {
        method: 'POST',
        headers: { 'wwauthmanagertoken': 'auth ' + token },
        data: {
            filename: 'manager.js',
            objectVersionId: objectVersionId
        }
    }

    switch (objectType) {
        case 'wwObject':
            options.url = server + '/wwobjects/' + objectName + '/request_upload'
            break;
        case 'section':
            options.url = server + '/sectionbases/' + objectName + '/request_upload'
            break;
        default:
            console.log('Error : unknown object type.')
            return
            break;
    }

    uploadUrl
    try {
        response = await axios(options);
        uploadUrl = response.data.uploadUrl
        objectVersionId = response.data.objectVersionId
    }
    catch (error) {
        console.log('Error : An error occured')
        return
    }


    /*=============================================m_ÔÔ_m=============================================\
      UPLOAD MANAGER.JS TO S3
    \================================================================================================*/

    try {
        await axios({
            method: 'PUT',
            url: uploadUrl,
            headers: {
                "Accept": '*/*'
            },
            skipAuthorization: true,
            data: managerJS,
        })
    } catch (error) {
        console.log('Error : Upload error.', error)
        return
    }

    console.log('-- manager.js upload ok --')

    console.log('-- UPLOAD DONE --')

}


run();
