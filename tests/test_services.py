import unittest
import sys
import os
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.auth_service import AuthService
from services.user_service import UserService
from services.routine_service import RoutineService
from services.profile_service import ProfileService
from services.admin_service import AdminService

class TestServices(unittest.TestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.auth_service = AuthService()
        self.auth_service.db = self.mock_db
        
        self.user_service = UserService()
        self.user_service.db = self.mock_db
        
        self.routine_service = RoutineService()
        self.routine_service.db = self.mock_db
        
        self.profile_service = ProfileService()
        self.profile_service.db = self.mock_db
        
        self.admin_service = AdminService()
        self.admin_service.db = self.mock_db

    # --- AuthService Tests ---
    @patch('services.auth_service.ensure_user_status')
    @patch('services.auth_service.check_password_hash')
    def test_auth_login_success(self, mock_check_hash, mock_ensure_status):
        mock_check_hash.return_value = True
        mock_ensure_status.return_value = "active"
        self.mock_db.users.find_one.return_value = {
            "user_id": "test_user",
            "password_hash": "hashed_pass",
            "email": "test@test.com",
            "username": "test_user"
        }
        
        user_data, err, status = self.auth_service.login_user("test_user", "password")
        self.assertIsNone(err)
        self.assertEqual(status, 200)
        self.assertEqual(user_data["user_id"], "test_user")

    def test_auth_register_duplicate(self):
        # Return a user to simulate username already in use
        self.mock_db.users.find_one.return_value = {"user_id": "exists"}
        
        user_data, err, status = self.auth_service.register_user({
            "name": "Test",
            "username": "exists",
            "email": "test@test.com",
            "password": "password123"
        })
        self.assertIsNone(user_data)
        self.assertEqual(status, 409)
        self.assertEqual(err, "El usuario ya está en uso.")

    # --- UserService Tests ---
    def test_user_update_role(self):
        self.user_service.update_role("user123", "admin")
        self.mock_db.user_roles.update_one.assert_called_once()
        args, kwargs = self.mock_db.user_roles.update_one.call_args
        self.assertEqual(args[0]["user_id"], "user123")
        self.assertEqual(args[1]["$set"]["role"], "admin")

    # --- RoutineService Tests ---
    def test_routine_assign(self):
        self.mock_db.routine_assignments.insert_one.return_value.inserted_id = "assign_1"
        res = self.routine_service.assign_routine("user1", "routine1", valid_days=7)
        self.assertEqual(res, "assign_1")
        self.mock_db.routine_assignments.insert_one.assert_called_once()

    # --- ProfileService Tests ---
    def test_profile_get_full(self):
        self.mock_db.users.find_one.return_value = {"user_id": "u1", "name": "Test"}
        self.mock_db.user_profiles.find_one.return_value = {"user_id": "u1", "phone": "123"}
        self.mock_db.body_assessments.find_one.return_value = None
        
        profile = self.profile_service.get_full_profile("u1")
        self.assertEqual(profile["name"], "Test")
        self.assertEqual(profile.get("phone"), "123")

    # --- AdminService Tests ---
    def test_admin_broadcast_in_app(self):
        self.mock_db.users.find.return_value = [{"_id": "obj1"}]
        self.mock_db.notifications.insert_many.return_value.inserted_ids = ["n1"]
        
        res = self.admin_service.broadcast_notifications("Title", "Msg", send_in_app=True)
        self.assertEqual(res["in_app_count"], 1)
        self.mock_db.notifications.insert_many.assert_called_once()

if __name__ == '__main__':
    unittest.main()
