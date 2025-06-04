// STIXN to HubSpot Integration Script
(function() {
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
        const checkboxes = document.querySelectorAll('.js-filter');
        
        // Restore checkbox states from localStorage
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        checkboxes.forEach(checkbox => {
            const storedActivity = storedActivities.find(a => a.id === checkbox.value);
            if (storedActivity) {
                checkbox.checked = true;
            }
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        const emailField = document.getElementById('reservation_customer_form_email');
        if (emailField) {
            // Restore email from localStorage
            const storedEmail = localStorage.getItem('userEmail');
            if (storedEmail) {
                emailField.value = storedEmail;
            }
            // Only listen for blur event
            emailField.addEventListener('blur', handleEmailBlur);
        }

        const submitButton = document.querySelector('.js-pressFinalize');
        if (submitButton) {
            submitButton.addEventListener('click', handleSubmit);
        }
    }

    // Handle checkbox changes
    function handleCheckboxChange(event) {
        const selectedActivities = collectSelectedActivities();
        
        // Store in localStorage
        localStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));
        
        // Log ALL localStorage contents
        console.log('=== LOCALSTORAGE CONTENTS ===');
        console.log('selectedActivities:', JSON.parse(localStorage.getItem('selectedActivities') || '[]'));
        console.log('userEmail:', localStorage.getItem('userEmail'));
        
        // If we have an email, update HubSpot with 'Nee'
        const email = localStorage.getItem('userEmail');
        if (email) {
            updateHubSpotWithStoredData(false);
        }
    }

    // Handle email blur
    async function handleEmailBlur(event) {
        const email = event.target.value;
        if (email) {
            console.log('=== EMAIL BLUR ===');
            console.log('Email:', email);
            
            localStorage.setItem('userEmail', email);
            // Update HubSpot with stored data and 'Nee' status
            await updateHubSpotWithStoredData(false);
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
    async function updateHubSpotWithStoredData(isFinal) {
        const email = localStorage.getItem('userEmail');
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        
        console.log('=== UPDATING HUBSPOT ===');
        console.log('Email:', email);
        console.log('Activities:', storedActivities);
        console.log('Is final submission:', isFinal);
        
        if (email && storedActivities.length > 0) {
            try {
                await updateHubSpotContact({
                    email: email,
                    activities: storedActivities
                }, isFinal);
            } catch (error) {
                console.error('Error updating HubSpot:', error);
            }
        }
    }

    // Handle form submission
    async function handleSubmit(event) {
        console.log('=== FINAL SUBMIT ===');
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

        try {
            // Update HubSpot with final status
            await updateHubSpotWithStoredData(!isNextButton);
        } catch (error) {
            console.error('Error submitting to HubSpot:', error);
        }
    }

    // Update HubSpot contact
    async function updateHubSpotContact(formData, isFinal) {
        console.log('=== SENDING TO HUBSPOT ===');
        console.log('Is final submission:', isFinal);
        console.log('Form data:', formData);
        
        // Format activities as a simple string
        const activitiesString = formData.activities
            .map(a => a.name.trim())
            .filter(name => name)
            .join(', ');
            
        console.log('Activities string:', activitiesString);

        // Get name fields
        const nickname = document.getElementById('reservation_customer_form_nickname')?.value || '';
        const surname = document.getElementById('reservation_customer_form_surname')?.value || '';
        const fullName = `${nickname} ${surname}`.trim();
        
        const contactData = {
            properties: {
                name: nickname + ' ' + surname || '',
                email: formData.email,
                gekozen_activiteit: activitiesString || '',
                reservatie_voltooid: isFinal ? true : false
            }
        };

        console.log('Contact data being sent:', contactData);

        try {
            const response = await fetch(`${config.proxyEndpoint}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contactData)
            });

            const responseText = await response.text();
            console.log('HubSpot response:', responseText);

            if (!response.ok) {
                throw new Error(`Failed to update contact: ${response.status} - ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error('Error in updateHubSpotContact:', error);
            throw error;
        }
    }

    // Start the script
    init();
})(); 