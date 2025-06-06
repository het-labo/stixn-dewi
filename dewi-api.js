const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cors = require('cors');

// Load env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const DEWI_API_KEY = process.env.DEWI_API_KEY;
const HUBSPOT_API_URL = 'https://api.hubapi.com/crm/v3/objects/contacts';
const DEWI_BASE_URL = 'https://marvel.demo2.dewi-online.nl/api';
const DEFAULT_CLUB_ID = 232;

app.use(cors());
app.use(bodyParser.json());

async function fetchActivitiesFromDewi(clubId = DEFAULT_CLUB_ID) {
  const response = await axios.get(`${DEWI_BASE_URL}/clubs/${clubId}/activities`, {
    headers: { Authorization: `Bearer ${DEWI_API_KEY}` }
  });
  return response.data;
}

app.post('/hubspot/save-user', async (req, res) => {
  const { name, lastname, email, reservation_completed } = req.body;

  if (!name || !lastname || !email) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const activitiesData = await fetchActivitiesFromDewi();
    const activityNames = activitiesData.map(a => a.name);

    const headers = {
      Authorization: `Bearer ${HUBSPOT_API_KEY}`,
      'Content-Type': 'application/json',
    };

    const properties = {
      firstname: name,
      lastname: lastname,
      email: email,
      chosen_activities: activityNames.join(', '),
      reservation_completed: reservation_completed.toString(),
    };

    const payload = { properties };

    // Try to create contact
    const response = await axios.post(HUBSPOT_API_URL, payload, { headers });
    return res.status(201).json({ status: 'created', contact_id: response.data.id });
  } catch (error) {
    // If conflict, try update
    if (error.response && error.response.status === 409) {
      try {
        const searchResp = await axios.get(
          `https://api.hubapi.com/crm/v3/objects/contacts?email=${email}`,
          { headers: { Authorization: `Bearer ${HUBSPOT_API_KEY}` } }
        );

        const results = searchResp.data.results;
        if (results && results.length > 0) {
          const contactId = results[0].id;
          const updateUrl = `${HUBSPOT_API_URL}/${contactId}`;

          await axios.patch(updateUrl, { properties }, { headers });

          return res.status(200).json({ status: 'updated', contact_id: contactId });
        }

        return res.status(404).json({ error: 'Contact not found for update.' });
      } catch (updateError) {
        return res.status(500).json({ error: updateError.message });
      }
    } else {
      return res.status(error.response?.status || 500).json({ error: error.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
