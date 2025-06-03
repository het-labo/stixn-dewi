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
            // Restore checkbox state from localStorage
            const storedActivities = JSON.parse(localStorage.getItem('selectedActivities') || '[]');
            if (storedActivities.some(activity => activity.id === checkbox.value)) {
                checkbox.checked = true;
            }
        });

        // Monitor email field
        const emailField = document.getElementById('reservation_customer_form_email');
        if (emailField) {
            emailField.addEventListener('input', handleFormChange);
            // Restore email from localStorage
            const storedEmail = localStorage.getItem('userEmail');
            if (storedEmail) {
                emailField.value = storedEmail;
            }
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
        // Store selected activities in localStorage
        localStorage.setItem('selectedActivities', JSON.stringify(formData.activities));
        
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
        const formData = collectFormData();
        // Store email in localStorage
        if (formData.email) {
            localStorage.setItem('userEmail', formData.email);
        }
    }

    // Collect form data
    function collectFormData() {
        const selectedActivities = Array.from(document.querySelectorAll('.js-filter:checked'))
            .map(checkbox => ({
                id: checkbox.value,
                name: checkbox.nextElementSibling.textContent
            }));

        console.log('Selected Activities:', selectedActivities);

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
            // Clear localStorage after successful submission
            localStorage.removeItem('selectedActivities');
            localStorage.removeItem('userEmail');
        } catch (error) {
            console.error('Error submitting to HubSpot:', error);
        }
    }

    // Update HubSpot contact
    async function updateHubSpotContact(formData, reservatieStatus) {
        console.log('Form Data being sent to HubSpot:', formData);
        console.log('Activities being sent:', formData.activities);
        
        const contactData = {
            properties: {
                email: formData.email,
                gekozen_activiteit: formData.activities.map(a => a.name).join(', '),
                reservatie_voltooid: reservatieStatus
            }
        };

        console.log('Final contact data being sent:', contactData);

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