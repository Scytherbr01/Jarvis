import Contacts

enum ContactsLookupError: Error {
    case notAuthorized
    case notFound(String)
}

/// Resolves a spoken name ("call mom") to a phone number via the
/// on-device Contacts database. Never leaves the device.
enum ContactsLookup {
    static func phoneNumber(forName name: String) async throws -> String {
        let store = CNContactStore()
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .notDetermined {
            let granted = try await store.requestAccess(for: .contacts)
            if !granted { throw ContactsLookupError.notAuthorized }
        } else if status != .authorized {
            throw ContactsLookupError.notAuthorized
        }

        let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactPhoneNumbersKey] as [CNKeyDescriptor]
        let predicate = CNContact.predicateForContacts(matchingName: name)
        let matches = try store.unifiedContacts(matching: predicate, keysToFetch: keys)

        guard let contact = matches.first, let number = contact.phoneNumbers.first?.value.stringValue else {
            throw ContactsLookupError.notFound(name)
        }
        return number
    }

    static func emailAddress(forName name: String) async throws -> String {
        let store = CNContactStore()
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .notDetermined {
            let granted = try await store.requestAccess(for: .contacts)
            if !granted { throw ContactsLookupError.notAuthorized }
        } else if status != .authorized {
            throw ContactsLookupError.notAuthorized
        }

        let keys = [CNContactGivenNameKey, CNContactFamilyNameKey, CNContactEmailAddressesKey] as [CNKeyDescriptor]
        let predicate = CNContact.predicateForContacts(matchingName: name)
        let matches = try store.unifiedContacts(matching: predicate, keysToFetch: keys)

        guard let contact = matches.first, let email = contact.emailAddresses.first?.value as String? else {
            throw ContactsLookupError.notFound(name)
        }
        return email
    }

    /// If `target` already looks like a phone number, use it directly;
    /// otherwise try resolving it as a contact name.
    static func resolve(_ target: String) async throws -> String {
        let digitCount = target.filter(\.isNumber).count
        if digitCount >= 7 {
            return target
        }
        return try await phoneNumber(forName: target)
    }
}
