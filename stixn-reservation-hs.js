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
        const selectedActivities = collectSelectedActivities();
        console.log('=== CHECKBOX CLICKED ===');
        console.log('Selected activities:', selectedActivities);
        
        // Store in localStorage
        localStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));
        
        // If we have an email, update HubSpot with 'Nee'
        const email = localStorage.getItem('userEmail');
        if (email) {
            updateHubSpotWithStoredData(false);
        }
    }

    // Handle email changes
    async function handleEmailChange(event) {
        const email = event.target.value;
        if (email) {
            console.log('=== EMAIL ENTERED ===');
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
            
            // Clear localStorage after successful submission
            localStorage.removeItem('selectedActivities');
            localStorage.removeItem('userEmail');
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
        
        const contactData = {
            properties: {
                email: formData.email,
                gekozen_activiteit: activitiesString || '',
                reservatie_voltooid: isFinal ? 'Ja' : 'Nee'
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