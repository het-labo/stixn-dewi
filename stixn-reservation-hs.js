// STIXN to HubSpot Integration Script
(function() {
    const config = {
        proxyEndpoint: 'https://stixn-express-api.onrender.com/api/hubspot'
    };

    function init() {
        const cookies = [
            'hubspotutk',
            'hubspotapi',
            'hubspotapi_*',
            'hubspotapi_*_*'
        ];

        cookies.forEach(cookie => {
            document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.dewi-online.nl;`;
            document.cookie = `${cookie}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });

        // Clear HubSpot related localStorage items
        localStorage.removeItem('hubspotutk');
        localStorage.removeItem('hubspotapi');

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupEventListeners);
        } else {
            setupEventListeners();
        }
    }

    function setupEventListeners() {
        const checkboxes = document.querySelectorAll('.js-filter');
        const storedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');

        checkboxes.forEach(checkbox => {
            const storedActivity = storedActivities.find(a => a.type === 'filter' && a.name === checkbox.value);
            if (storedActivity) {
                checkbox.checked = true;
            }
            checkbox.addEventListener('change', handleCheckboxChange);
        });

        const activities = document.querySelectorAll('.js-activity');
        activities.forEach(activity => {
            const addButton = activity.querySelector('.js-add-activity');
            if (addButton) {
                addButton.addEventListener('click', () => handleActivityClick(activity));
            }
        });

        const emailField = document.getElementById('reservation_customer_form_email');
        if (emailField) {
            const storedEmail = sessionStorage.getItem('userEmail');
            if (storedEmail) {
                emailField.value = storedEmail;
            }

            // 🔒 Disable autofill
            emailField.setAttribute('autocomplete', 'off');
            emailField.setAttribute('name', 'email-' + Date.now());

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

    function handleActivityClick(activityElement) {
        const activityTitle = activityElement.querySelector('.activity-title')?.textContent.trim() || '';
        if (activityTitle) {
            const selectedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');
            const isAlreadySelected = selectedActivities.some(activity =>
                activity.type === 'activity' && activity.name === activityTitle
            );

            if (!isAlreadySelected) {
                selectedActivities.push({
                    name: activityTitle,
                    type: 'activity'
                });

                sessionStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));

                const email = sessionStorage.getItem('userEmail');
                if (email) {
                    updateHubSpotWithStoredData(false);
                }
            }
        }
    }

    function handleCheckboxChange(event) {
        const selectedActivities = collectSelectedActivities();
        sessionStorage.setItem('selectedActivities', JSON.stringify(selectedActivities));

        const email = sessionStorage.getItem('userEmail');
        if (email) {
            updateHubSpotWithStoredData(false);
        }
    }

    async function handleEmailBlur(event) {
        const email = event.target.value;
        if (email) {
            sessionStorage.setItem('userEmail', email);

            const nicknameField = document.getElementById('reservation_customer_form_nickname');
            const surnameField = document.getElementById('reservation_customer_form_surname');

            const nickname = nicknameField?.value?.trim() || '';
            const surname = surnameField?.value?.trim() || '';

            await updateHubSpotWithStoredData(false, {
                firstname: nickname || undefined,
                lastname: surname || undefined
            });
        }
    }

    function collectSelectedActivities() {
        const activities = [];

        document.querySelectorAll('.js-filter:checked').forEach(checkbox => {
            const label = document.querySelector(`label[for="${checkbox.id}"]`);
            if (label) {
                activities.push({
                    name: label.textContent.trim(),
                    type: 'filter'
                });
            }
        });

        const storedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');
        const clickedActivities = storedActivities.filter(a => a.type === 'activity');
        activities.push(...clickedActivities);

        return activities;
    }

    async function updateHubSpotWithStoredData(isFinal, additionalProperties = {}) {
        const email = sessionStorage.getItem('userEmail');
        const storedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');

        if (email && storedActivities.length > 0) {
            try {
                await updateHubSpotContact({
                    email: email,
                    activities: storedActivities,
                    ...additionalProperties
                }, isFinal);
            } catch (error) {
                console.error('Error updating HubSpot:', error);
            }
        }
    }

    async function handleSubmit(event) {
        console.log('=== FINAL SUBMIT BUTTON CLICKED ===');
        console.log('Button classes:', event.target.className);

        const email = sessionStorage.getItem('userEmail');
        const storedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');

        if (!email) {
            console.log('No email found, skipping submission');
            return;
        }

        try {
            // Submit to HubSpot with final flag
            await updateHubSpotWithStoredData(true);

            // ✅ Unconditionally clear sessionStorage
            console.log('Clearing sessionStorage after final step submit');
            sessionStorage.clear();

            // Optional: Clear any autofilled email field
            const emailField = document.getElementById('reservation_customer_form_email');
            if (emailField) {
                emailField.setAttribute('autocomplete', 'off');
                emailField.setAttribute('name', 'email-' + Date.now());
                emailField.value = '';
            }

        } catch (error) {
            console.error('Error during final HubSpot submission:', error);
        }
    }

    async function handlePaymentFormClick() {
        const email = sessionStorage.getItem('userEmail');
        if (email) {
            try {
                await updateHubSpotWithStoredData(true);
            } catch (error) {
                console.error('Error updating HubSpot on payment form click:', error);
            }
        }
    }

    async function updateHubSpotContact(formData, isFinal) {
        const selectedActivities = JSON.parse(sessionStorage.getItem('selectedActivities') || '[]');

        const filterActivities = selectedActivities
            .filter(a => a.type === 'filter')
            .map(a => a.name.trim());

        const clickedActivities = selectedActivities
            .filter(a => a.type === 'activity')
            .map(a => a.name.trim());

        const allActivities = [...filterActivities, ...clickedActivities]
            .filter(name => name)
            .join(', ');

        let nickname = formData.firstname;
        let surname = formData.lastname;

        if (nickname === undefined || surname === undefined) {
            const nicknameField = document.getElementById('reservation_customer_form_nickname');
            const surnameField = document.getElementById('reservation_customer_form_surname');

            nickname = nickname || nicknameField?.value?.trim() || undefined;
            surname = surname || surnameField?.value?.trim() || undefined;
        }

        const contactData = {
            properties: {
                email: formData.email,
                firstname: nickname,
                lastname: surname,
                gekozen_activiteit: allActivities,
                reservatie_voltooid: isFinal ? true : false
            }
        };

        Object.keys(contactData.properties).forEach(key => {
            if (contactData.properties[key] === undefined) {
                delete contactData.properties[key];
            }
        });

        try {
            const response = await fetch(`${config.proxyEndpoint}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(contactData)
            });

            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(`Failed to update contact: ${response.status} - ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            console.error('Error in updateHubSpotContact:', error);
            throw error;
        }
    }

    init();
})();
