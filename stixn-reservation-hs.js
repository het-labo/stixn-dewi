// STIXN to HubSpot Integration Script
(function() {
    // Clear localStorage at start
    localStorage.removeItem('selectedActivities');
    localStorage.removeItem('userEmail');

    // Configuration
    const config = {
        proxyEndpoint: 'https://stixn-express-api.onrender.com/api/hubspot'
    };

    // Initialize the script
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }
    }

    // Set up event listeners for form elements
    function setupEventListeners() {
        // Debug form structure
        console.log('=== Form Structure Debug ===');
        
        const checkboxes = document.querySelectorAll('.js-filter');
        console.log('Found checkboxes:', checkboxes.length);
        checkboxes.forEach((checkbox, index) => {
            console.log(`Checkbox ${index}:`, {
                id: checkbox.id,
                value: checkbox.value,
                checked: checkbox.checked,
                label: document.querySelector(`label[for="${checkbox.id}"]`)?.textContent
            });
        });

        const emailField = document.getElementById('reservation_customer_form_email');
        console.log('Email field found:', !!emailField);
        if (emailField) {
            console.log('Email field value:', emailField.value);
            emailField.addEventListener('input', handleEmailChange);
        }

        const submitButton = document.querySelector('.js-pressFinalize');
        console.log('Submit button found:', !!submitButton);
        if (submitButton) {
            console.log('Submit button classes:', submitButton.className);
            submitButton.addEventListener('click', handleSubmit);
        }

        // Set up checkbox listeners
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });
    }

    // Handle checkbox changes
    function handleCheckboxChange(event) {
        console.log('Checkbox changed:', {
            id: event.target.id,
            value: event.target.value,
            checked: event.target.checked,
            label: document.querySelector(`label[for="${event.target.id}"]`)?.textContent
        });

        // Store selected activities in localStorage
        const selectedActivities = collectSelectedActivities();
        localStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));
        
        // If we have an email, update HubSpot
        const email = localStorage.getItem('userEmail');
        if (email) {
            updateHubSpotWithStoredData();
        }
    }

    // Handle email changes
    async function handleEmailChange(event) {
        const email = event.target.value;
        if (email) {
            localStorage.setItem('userEmail', email);
            // Update HubSpot with stored data when email is entered
            await updateHubSpotWithStoredData();
        }
    }

    // Collect selected activities
    function collectSelectedActivities() {
        return Array.from(document.querySelectorAll('.js-filter:checked'))
            .map(checkbox => {
                const label = document.querySelector(`label[for="${checkbox.id}"]`);
                return {
                    id: checkbox.value,
                    name: label ? label.textContent.trim() : ''
                };
            });
    }

    // Update HubSpot with stored data
    async function updateHubSpotWithStoredData() {
        const email = localStorage.getItem('userEmail');
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        
        if (email && storedActivities.length > 0) {
            try {
                await updateHubSpotContact({
                    email: email,
                    activities: storedActivities
                }, false);
            } catch (error) {
                console.error('Error updating HubSpot:', error);
            }
        }
    }

    // Handle form submission
    async function handleSubmit(event) {
        console.log('Submit button clicked');
        console.log('Button element:', event.target);
        console.log('Button classes:', event.target.className);
        
        const email = localStorage.getItem('userEmail');
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        
        if (!email) {
            console.log('No email found, returning');
            return;
        }

        // Check if the button has btn--next class
        const isNextButton = event.target.classList.contains('btn--next');
        console.log('Is next button:', isNextButton);
        console.log('Will set reservatie_voltooid to:', !isNextButton);

        try {
            // Only set reservatie_voltooid to true if it's not a next button
            await updateHubSpotContact({
                email: email,
                activities: storedActivities
            }, !isNextButton);
            console.log('HubSpot update completed with reservatie_voltooid:', !isNextButton);
            
            // Clear localStorage after successful submission
            localStorage.removeItem('selectedActivities');
            localStorage.removeItem('userEmail');
        } catch (error) {
            console.error('Error submitting to HubSpot:', error);
        }
    }

    // Update HubSpot contact
    async function updateHubSpotContact(formData, reservatieStatus) {
        console.log('Updating HubSpot contact with status:', reservatieStatus);
        console.log('Raw form data:', formData);
        
        // Format activities as a simple string, ensuring no extra spaces
        const activitiesString = formData.activities
            .map(a => a.name.trim())
            .filter(name => name) // Remove any empty strings
            .join(', ');
            
        console.log('Activities string being sent:', activitiesString);
        
        const contactData = {
            properties: {
                email: formData.email,
                gekozen_activiteit: activitiesString || '', // Ensure we never send undefined
                reservatie_voltooid: reservatieStatus
            }
        };

        console.log('Full contact data being sent to HubSpot:', JSON.stringify(contactData, null, 2));

        try {
            const response = await fetch(`${config.proxyEndpoint}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contactData)
            });

            const responseText = await response.text();
            console.log('Raw HubSpot response:', responseText);

            if (!response.ok) {
                console.error('HubSpot API Error Response:', responseText);
                throw new Error(`Failed to update contact: ${response.status} - ${responseText}`);
            }

            let responseData;
            try {
                responseData = JSON.parse(responseText);
                console.log('Parsed HubSpot response:', responseData);
            } catch (e) {
                console.error('Error parsing HubSpot response:', e);
                throw new Error('Invalid JSON response from HubSpot');
            }

            return responseData;
        } catch (error) {
            console.error('Error in updateHubSpotContact:', error);
            throw error;
        }
    }

    // Start the script
    init();
})(); 