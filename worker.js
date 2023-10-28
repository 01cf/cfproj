addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const key = url.pathname.slice(1);

  // Check if the request is for the /secure/:country route
  if (key.startsWith('secure/')) {
    // Extract the country code from the URL
    const countryCode = key.split('/')[1];
    
    // If there's no country code, continue with processing the display user info function below
    if (!countryCode) {
      return displayUserInfo(request);
    }

    const imageKey = `${countryCode.toLowerCase()}.png`;

    // Fetch the image from the bucket
    const object = await MY_BUCKET.get(imageKey);
    if (object === null) {
      return new Response('Image Not Found', { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Return the image in the response
    return new Response(object.body, {
      headers,
    });
  }

  return displayUserInfo(request);
}

async function displayUserInfo(request) {
  // Extract the 'CF_Authorization' cookie to get the IAT value (https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/application-token/)
  const cookie = request.headers.get('Cookie');
  let jwtToken = '';

  if (cookie) {
    const cookiePairs = cookie.split('; ');
    for (const pair of cookiePairs) {
      const [name, value] = pair.split('=');
      if (name === 'CF_Authorization') {
        jwtToken = value;
        break; // Exit the loop once we've found the cookie
      }
    }
  }

  // Initialize variables to hold the extracted data
  let email = '';
  let issuanceTimestamp = '';
  let country = '';

  // If the 'CF_Authorization' cookie is found, decode the JWT token
  if (jwtToken) {
    const decodedToken = decodeJWT(jwtToken);
    email = decodedToken.email || '';
    issuanceTimestamp = formatUnixTimestamp(decodedToken.iat) || '';
  }

  // Get the country from Cloudflare's properties
  const cf = request.cf;
  country = cf.country || '';

  // Construct the response body
  const responseBody = `${email} authenticated at ${issuanceTimestamp} from <a href="/secure/${country}">${country}</a><br>`;

  // Create a new Response with the extracted data
  return new Response(responseBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

// JWT decode function
function decodeJWT(token) {
  const [header, payload, signature] = token.split('.');
  const decodedPayload = atob(payload);
  return JSON.parse(decodedPayload);
}

// function to convert unix timestamp to UTC time so that its human readable.
function formatUnixTimestamp(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000); // Convert Unix timestamp to milliseconds
  return date.toUTCString(); // Format as UTC time
}

