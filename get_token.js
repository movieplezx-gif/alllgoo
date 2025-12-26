const axios = require('axios');

const code = '4TqzcN-aXpIAAAAAAAAAV1NcdhBIDms7aJQoCDuoBYM';
const clientId = '3qlxd400yvvwr5k';
const clientSecret = 'ige0wyt57rk3pqb';

async function getToken() {
    try {
        const response = await axios.post('https://api.dropbox.com/oauth2/token', null, {
            params: {
                code: code,
                grant_type: 'authorization_code',
                client_id: clientId,
                client_secret: clientSecret
            }
        });
        console.log('REFRESH_TOKEN_START');
        console.log(response.data.refresh_token);
        console.log('REFRESH_TOKEN_END');
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

getToken();
