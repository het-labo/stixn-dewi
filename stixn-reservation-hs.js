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
        // Handle filter checkboxes
        const checkboxes = document.querySelectorAll('.js-filter');
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        checkboxes.forEach(checkbox => {
            const storedActivity = storedActivities.find(a => a.id === checkbox.value);
            if (storedActivity) {
                checkbox.checked = true;
            }
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        // Handle activity elements
        const activities = document.querySelectorAll('.js-activity');
        activities.forEach(activity => {
            const addButton = activity.querySelector('.js-add-activity');
            if (addButton) {
                addButton.addEventListener('click', () => handleActivityClick(activity));
            }
        });

        const emailField = document.getElementById('reservation_customer_form_email');
        if (emailField) {
            const storedEmail = localStorage.getItem('userEmail');
            if (storedEmail) {
                emailField.value = storedEmail;
            }
            emailField.addEventListener('blur', handleEmailBlur);
        }

        const submitButton = document.querySelector('.js-pressFinalize');
        if (submitButton) {
            submitButton.addEventListener('click', handleSubmit);
        }

        const paymentForm = document.querySelector('.js-payment-form');
        if (paymentForm) {
            paymentForm.addEventListener('click', handlePaymentFormClick);
        }
    }

    // Handle activity click
    function handleActivityClick(activityElement) {
        const activityTitle = activityElement.querySelector('.activity-title')?.textContent.trim() || '';
        
        if (activityTitle) {
            // Get existing activities
            const selectedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
            
            // Check if this activity is already in the list
            const isAlreadySelected = selectedActivities.some(activity => activity.name === activityTitle);
            
            if (!isAlreadySelected) {
                // Add new activity to the list
                selectedActivities.push({
                    name: activityTitle
                });
                
                // Store updated list in localStorage
                localStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));
                
                // Log localStorage contents
                console.log('=== LOCALSTORAGE CONTENTS ===');
                console.log('selectedActivities:', selectedActivities);
                console.log('userEmail:', localStorage.getItem('userEmail'));
                
                // If we have an email, update HubSpot
                const email = localStorage.getItem('userEmail');
                if (email) {
                    updateHubSpotWithStoredData(false);
                }
            }
        }
    }

    // Handle checkbox changes
    function handleCheckboxChange(event) {
        const selectedActivities = collectSelectedActivities();
        
        // Store in localStorage
        localStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));
        
        // Log localStorage contents
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
        const activities = [];
        
        // Get activities from js-filter checkboxes
        document.querySelectorAll('.js-filter:checked').forEach(checkbox => {
            const label = document.querySelector(`label[for="${checkbox.id}"]`);
            if (label) {
                activities.push({
                    name: label.textContent.trim()
                });
            }
        });
        
        // Get activities from js-activity elements that were clicked
        const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
        storedActivities.forEach(activity => {
            if (!activities.some(a => a.name === activity.name)) {
                activities.push(activity);
            }
        });
        
        return activities;
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

    // Handle payment form click
    async function handlePaymentFormClick() {
        console.log('=== PAYMENT FORM CLICKED ===');
        const email = localStorage.getItem('userEmail');
        if (email) {
            try {
                await updateHubSpotWithStoredData(true);
                console.log('Updated HubSpot with reservatie_voltooid = true');
            } catch (error) {
                console.error('Error updating HubSpot on payment form click:', error);
            }
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
        
        const contactData = {
            properties: {
                email: formData.email,
                firstname: nickname,
                lastname: surname,
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