// STIXN to HubSpot Integration Script
(function() {
    // Configuration
    const config = {
        proxyEndpoint: 'https://stixn-express-api.onrender.com/api/hubspot'
    };

    // Initialize the script
    function init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }
    }

    // Set up event listeners for form elements
    function setupEventListeners() {
        // Monitor checkboxes
        const checkboxes = document.querySelectorAll('.js-filter');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        // Monitor email field
        const emailField = document.getElementById('reservation_customer_form_email');
        if (emailField) {
            emailField.addEventListener('input', handleFormChange);
        }

        // Monitor submit button
        const submitButton = document.querySelector('.js-finalize');
        if (submitButton) {
            submitButton.addEventListener('click', handleSubmit);
        }
    }

    // Handle checkbox changes
    async function handleCheckboxChange(event) {
        const formData = collectFormData();
        if (formData.email) {
            try {
                await updateHubSpotContact(formData, false);
            } catch (error) {
                console.error('Error updating HubSpot:', error);
            }
        }
    }

    // Handle form changes
    function handleFormChange() {
        collectFormData();
    }

    // Collect form data
    function collectFormData() {
        const selectedActivities = Array.from(document.querySelectorAll('.js-filter:checked'))
            .map(checkbox => ({
                id: checkbox.value,
                name: checkbox.nextElementSibling.textContent
            }));

        const email = document.getElementById('reservation_customer_form_email')?.value || '';

        return {
            activities: selectedActivities,
            email: email
        };
    }

    // Handle form submission
    async function handleSubmit(event) {
        const formData = collectFormData();
        
        if (!formData.email) {
            return;
        }

        try {
            await updateHubSpotContact(formData, true);
            // Don't prevent default - let the form continue its normal submission
        } catch (error) {
            console.error('Error submitting to HubSpot:', error);
            // Even if HubSpot update fails, let the form continue
        }
    }

    // Update HubSpot contact
    async function updateHubSpotContact(formData, reservatieStatus) {
        const contactData = {
            properties: {
                email: formData.email,
                gekozen_activiteit: formData.activities.map(a => a.name).join(', '),
                reservatie_voltooid: reservatieStatus
            }
        };

        const response = await fetch(`${config.proxyEndpoint}/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactData)
        });

        if (!response.ok) {
            throw new Error(`Failed to update contact: ${response.status}`);
        }

        return await response.json();
    }

    // Start the script
    init();
})(); 