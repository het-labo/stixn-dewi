const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable CORS for your frontend domain
app.use(cors({
    origin: ['https://het-labo.be', 'http://localhost:3000'],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Root route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Proxy endpoint for contact creation/update
app.post('/api/hubspot/contact', async (req, res) => {
    try {
        // Format the data according to HubSpot API specification
        const hubspotData = {
            properties: {
                email: req.body.properties.email,
                gekozen_activiteit: req.body.properties.gekozen_activiteit,
                reservatie_voltooid: req.body.properties.reservatie_voltooid
            }
        };

        console.log('Sending to HubSpot:', JSON.stringify(hubspotData, null, 2));

        // First try to find the contact by email
        const searchResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                filterGroups: [{
                    filters: [{
                        propertyName: 'email',
                        operator: 'EQ',
                        value: req.body.properties.email
                    }]
                }]
            })
        });

        const searchData = await searchResponse.json();
        console.log('Search response:', JSON.stringify(searchData, null, 2));

        let contactId = null;

        if (searchData.total > 0) {
            // Contact exists, get the ID
            contactId = searchData.results[0].id;
            console.log('Found existing contact:', contactId);
        }

        let response;
        if (contactId) {
            // Update existing contact
            console.log('Updating existing contact with data:', JSON.stringify(hubspotData, null, 2));
            response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hubspotData)
            });
        } else {
            // Create new contact
            console.log('Creating new contact with data:', JSON.stringify(hubspotData, null, 2));
            response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(hubspotData)
            });
        }

        // Log the response status and headers for debugging
        console.log('HubSpot Response Status:', response.status);
        console.log('HubSpot Response Headers:', response.headers);

        // Get the response text first
        const responseText = await response.text();
        console.log('HubSpot Response Body:', responseText);

        // Try to parse as JSON if possible
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON response from HubSpot: ${responseText}`);
        }

        if (!response.ok) {
            throw new Error(`HubSpot API error: ${data.message || responseText}`);
        }

        res.json(data);
    } catch (error) {
        console.error('Error details:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the form`);
}); 