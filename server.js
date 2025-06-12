const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable CORS for your frontend domain
app.use(cors({
    origin: ['https://het-labo.be', 'https://vrbase.dewi-online.nl'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight requests
app.options('*', cors());

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
        console.log('Received request body:', JSON.stringify(req.body, null, 2));
        
        if (!process.env.HUBSPOT_API_KEY) {
            throw new Error('HUBSPOT_API_KEY is not set in environment variables');
        }

        // Format the data according to HubSpot API specification
        const hubspotData = {
            properties: {
                email: req.body.properties.email,
                firstname: req.body.properties.firstname,
                lastname: req.body.properties.lastname,
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

            // If creation fails with "already exists" error, try to update
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.message && errorData.message.includes('Contact already exists')) {
                    const existingId = errorData.message.match(/Existing ID: (\d+)/)?.[1];
                    if (existingId) {
                        console.log('Contact exists, updating with ID:', existingId);
                        response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${existingId}`, {
                            method: 'PATCH',
                            headers: {
                                'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(hubspotData)
                        });
                    }
                }
            }
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
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: error.message,
            details: error.stack,
            requestBody: req.body
        });
    }
});

// New endpoint for tracking site visits
app.post('/api/hubspot/track', async (req, res) => {
    try {
        console.log('Received tracking request:', JSON.stringify(req.body, null, 2));
        
        if (!process.env.HUBSPOT_API_KEY) {
            throw new Error('HUBSPOT_API_KEY is not set in environment variables');
        }

        const { email, activities, page, timestamp } = req.body;

        // First, ensure the contact exists in HubSpot
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
                        value: email
                    }]
                }]
            })
        });

        const searchData = await searchResponse.json();
        let contactId = null;

        if (searchData.total > 0) {
            contactId = searchData.results[0].id;
        } else {
            // Create a new contact if it doesn't exist
            const createResponse = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    properties: {
                        email: email
                    }
                })
            });

            const createData = await createResponse.json();
            contactId = createData.id;
        }

        // Create an engagement for the site visit
        const engagementData = {
            engagement: {
                active: true,
                type: "SITE_VISIT",
                timestamp: new Date(timestamp).getTime()
            },
            associations: {
                contactIds: [contactId]
            },
            metadata: {
                url: page,
                title: "Activity Selection",
                activities: activities.map(a => a.name).join(', ')
            }
        };

        const engagementResponse = await fetch('https://api.hubapi.com/engagements/v1/engagements', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(engagementData)
        });

        if (!engagementResponse.ok) {
            throw new Error(`Failed to create engagement: ${engagementResponse.statusText}`);
        }

        const responseData = await engagementResponse.json();
        console.log('Created engagement:', responseData);

        res.json({ success: true, engagementId: responseData.id });
    } catch (error) {
        console.error('Error tracking site visit:', error);
        res.status(500).json({ 
            error: error.message,
            details: error.stack,
            requestBody: req.body
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to see the form`);
}); 