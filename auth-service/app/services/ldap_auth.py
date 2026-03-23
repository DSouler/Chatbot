import logging
from typing import Optional, Dict, Any
from ldap3 import Server, Connection, ALL, NTLM, SIMPLE
from ldap3.core.exceptions import LDAPException, LDAPBindError

from app.config import settings

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class LDAPAuth:
    def __init__(self):
        self.server_url = settings.ldap_server_url
        self.base_dn = settings.ldap_base_dn
        self.user_search_base = settings.ldap_user_search_base
        self.bind_dn = settings.ldap_bind_dn
        self.bind_password = settings.ldap_bind_password
        self.auth_type = settings.ldap_auth_type
        self.use_ssl = settings.ldap_use_ssl
        
        logger.info(f"LDAP Configuration loaded")
        
        if not all([self.server_url, self.user_search_base]):
            error_msg = "LDAP configuration is incomplete. LDAP authentication will be unavailable."
            logger.warning(error_msg)
            self._ldap_available = False
        else:
            self._ldap_available = True
    
    def _get_server(self) -> Server:
        """Create LDAP server connection"""
        logger.debug(f"Creating LDAP server connection to {self.server_url}")
        try:
            server = Server(self.server_url, get_info=ALL, use_ssl=self.use_ssl)
            logger.debug(f"LDAP server created successfully: {server}")
            return server
        except Exception as e:
            logger.error(f"Failed to create LDAP server: {e}")
            raise
    
    def _search_user(self, username: str) -> Optional[str]:
        """Search for user DN in LDAP directory"""
        logger.info(f"Searching for user: {username}")
        try:
            server = self._get_server()
            
            # Use service account for user search if configured
            if self.bind_dn and self.bind_password:
                logger.debug(f"Using service account for search: {self.bind_dn}")
                conn = Connection(server, user=self.bind_dn, password=self.bind_password, auto_bind=True)
                logger.debug("Service account connection established")
            else:
                logger.debug("Using anonymous connection for search")
                conn = Connection(server, auto_bind=True)
            
            search_filter = f"(|(uid={username})(sAMAccountName={username})(userPrincipalName={username})(mail={username}))"
            logger.debug(f"Search filter: {search_filter}")
            logger.debug(f"Search base: {self.user_search_base}")
            
            conn.search(
                search_base=self.user_search_base,
                search_filter=search_filter,
                attributes=['cn', 'mail', 'memberOf', 'sAMAccountName', 'userPrincipalName', 'distinguishedName']
            )
            
            logger.debug(f"Search completed. Found {len(conn.entries)} entries")
            
            if conn.entries:
                user_dn = conn.entries[0].entry_dn
                logger.info(f"User found with DN: {user_dn}")
                logger.debug(f"User attributes: {conn.entries[0]}")
                conn.unbind()
                return user_dn
            else:
                logger.warning(f"No user found for username: {username}")
            
            conn.unbind()
            return None
            
        except LDAPException as e:
            logger.error(f"LDAP user search failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during user search: {e}")
            return None
    
    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Authenticate user against LDAP server
        Returns user information if successful, None if failed
        """
        if not getattr(self, '_ldap_available', False):
            return None
        logger.info(f"Starting LDAP authentication for user: {username}")
        try:
            # First, find the user's DN
            logger.debug("Step 1: Searching for user DN")
            user_dn = self._search_user(username)
            if not user_dn:
                logger.warning(f"User {username} not found in LDAP directory")
                return None
            
            # Try to bind with user credentials
            logger.debug("Step 2: Attempting user authentication")
            server = self._get_server()
            auth_method = NTLM if self.auth_type == "NTLM" else SIMPLE
            logger.debug(f"Using authentication method: {auth_method}")
            
            logger.debug(f"Attempting to bind with DN: {user_dn}")
            conn = Connection(
                server,
                user=user_dn,
                password=password,
                authentication=auth_method,
                auto_bind=True
            )
            
            logger.debug("Authentication successful, retrieving user attributes")
            
            # If we reach here, authentication was successful
            # Get user attributes
            conn.search(
                search_base=user_dn,
                search_filter='(objectClass=*)',
                attributes=['cn', 'mail', 'memberOf', 'department', 'title', 'sAMAccountName']
            )
            
            user_info = {
                'username': username,
                'dn': user_dn,
                'authenticated': True
            }
            
            if conn.entries:
                entry = conn.entries[0]
                logger.debug(f"Retrieved user attributes: {entry}")
                print(f"Retrieved user attributes: {entry}")
                user_info.update({
                    'common_name': str(entry.cn) if hasattr(entry, 'cn') else username,
                    'email': str(entry.mail) if hasattr(entry, 'mail') else None,
                    'department': str(entry.department) if hasattr(entry, 'department') else None,
                    'title': str(entry.title) if hasattr(entry, 'title') else None,
                    'groups': [str(group) for group in entry.memberOf] if hasattr(entry, 'memberOf') else []
                })
            
            conn.unbind()
            logger.info(f"User {username} authenticated successfully")
            logger.debug(f"Final user info: {user_info}")
            return user_info
            
        except LDAPBindError as e:
            logger.warning(f"Authentication failed for user {username}: Invalid credentials - {e}")
            return None
        except LDAPException as e:
            logger.error(f"LDAP authentication error for user {username}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during LDAP authentication: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    def get_user_groups(self, username: str) -> list:
        """Get user's group memberships"""
        try:
            user_dn = self._search_user(username)
            if not user_dn:
                return []
            
            server = self._get_server()
            if self.bind_dn and self.bind_password:
                conn = Connection(server, user=self.bind_dn, password=self.bind_password, auto_bind=True)
            else:
                conn = Connection(server, auto_bind=True)
            
            conn.search(
                search_base=user_dn,
                search_filter='(objectClass=*)',
                attributes=['memberOf']
            )
            
            groups = []
            if conn.entries and hasattr(conn.entries[0], 'memberOf'):
                groups = [str(group) for group in conn.entries[0].memberOf]
            
            conn.unbind()
            return groups
            
        except LDAPException as e:
            logger.error(f"Error getting user groups: {e}")
            return []
