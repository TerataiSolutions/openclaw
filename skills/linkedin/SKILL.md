# Prospect Research Skill — NinjaPear API

You have access to the NinjaPear Employee API for prospect research before calls.
The API key is in the environment variable PROXYCURL_API_KEY.
The base URL is https://nubela.co

## CRITICAL RULES

1. Never fabricate or guess any information about a prospect.
2. Always call the NinjaPear API first and base your entire response on what it returns.
3. If the API returns no data, say so clearly. Do not fill gaps with assumptions.
4. Always ask for missing information before proceeding.

---

## INPUT OPTIONS

You need at least one of these combinations to look up a prospect:

Option A: Work email address
Option B: First name + employer website
Option C: Employer website + role title

Ask the user which they have available if they do not provide it upfront.

---

## FETCH PROSPECT PROFILE

Using work email:
```bash
curl -s -G "https://nubela.co/api/v1/employee/profile" \
  -H "Authorization: Bearer ${PROXYCURL_API_KEY}" \
  --data-urlencode "work_email=WORK_EMAIL_HERE"
```

Using first name and employer website:
```bash
curl -s -G "https://nubela.co/api/v1/employee/profile" \
  -H "Authorization: Bearer ${PROXYCURL_API_KEY}" \
  --data-urlencode "first_name=FIRST_NAME_HERE" \
  --data-urlencode "last_name=LAST_NAME_HERE" \
  --data-urlencode "employer_website=EMPLOYER_WEBSITE_HERE" \
  --data-urlencode "role=ROLE_HERE"
```

Using employer website and role only:
```bash
curl -s -G "https://nubela.co/api/v1/employee/profile" \
  -H "Authorization: Bearer ${PROXYCURL_API_KEY}" \
  --data-urlencode "employer_website=EMPLOYER_WEBSITE_HERE" \
  --data-urlencode "role=ROLE_HERE"
```

Report the exact HTTP status code before proceeding.
A 200 means data was found. A 404 means no data found for this person.
A 400 means invalid or missing parameters.

---

## BUILD THE PROSPECT BRIEF

Only after a successful 200 response, present this structure using only data returned by the API. Write "Not available" for any field not returned.

**PROSPECT BRIEF: [full_name from API]**

**Current Role**
[role from most recent work_experience entry] at [company_name from most recent work_experience entry]

**Location**
[city and country from API]

**Background**
[List their last 3 work experience entries with role, company, and dates]

**Education**
[List education entries from API]

**Social Presence**
- X/Twitter: [x_profile_url from API or Not available]
- Followers: [follower_count from API or Not available]
- Bio: [bio from API or Not available]

**Personalization Angles**
[Based strictly on what the API returned, suggest 2-3 specific conversation starters grounded in their actual career history and current role. Do not invent context.]

**Potential Objections**
[Based strictly on their actual role and company from the API, anticipate 1-2 realistic objections.]

---

## TRIGGER PHRASES

Use this skill when the user says:
- "Research [name]"
- "Prep me for my call with [name]"
- "I have a call with [name] at [company]"
- "Pull up [name] from [company]"
- "What do we know about [name]"

Always confirm what input information is available before calling the API.
