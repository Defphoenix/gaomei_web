from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APITestCase


class DevelopmentPasswordResetTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="reset-user", password="old-password-123")

    @override_settings(DEBUG=True, ALLOW_INSECURE_PASSWORD_RESET=True)
    def test_resets_password_in_local_development(self):
        response = self.client.post(
            "/api/auth/password-reset/",
            {
                "username": "reset-user",
                "new_password": "new-password-456",
                "new_password_confirm": "new-password-456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-password-456"))

    @override_settings(DEBUG=False, ALLOW_INSECURE_PASSWORD_RESET=False)
    def test_is_disabled_outside_local_development(self):
        response = self.client.post(
            "/api/auth/password-reset/",
            {
                "username": "reset-user",
                "new_password": "new-password-456",
                "new_password_confirm": "new-password-456",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 403)
