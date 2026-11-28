# Resume and Job Description Matching

## Workflow

1. Extract distinct requirements from the job description and classify each as **must-have**, **nice-to-have**, or **responsibility**. Preserve the employer's stated priorities and label any inferred priority. Count “Python or Go” as one requirement satisfied by either language. Split independently required qualifications such as “Python and SQL” into separate requirements. Consolidate duplicates before counting.
2. Compare every requirement with the supplied candidate material. Record the evidence and classify the match:

   | Match | Meaning |
   | --- | --- |
   | Explicit | The candidate material directly states the qualification. |
   | Semantic | Concrete evidence demonstrates the qualification using different terminology. |
   | Unclear | Related evidence exists, but it is insufficient to establish the requirement. |
   | Missing | The supplied material contains no supporting evidence. |

   A missing match means evidence is absent from the material, not proof that the candidate lacks the qualification. For semantic matches, explain the connection; related technology names alone do not establish equivalence.
3. Calculate must-have and nice-to-have coverage using **explicit + semantic** matches as the numerator and all distinct requirements in that category as the denominator. Keep unclear and missing matches outside the numerator. Show a category with no requirements as `N/A (0 requirements)`.

## Output

### Match assessment

- For must-haves and nice-to-haves separately, report X/Y covered from the Master CV, with explicit and semantic counts.
- Critical gaps and questions that could resolve unclear evidence.

Include a requirement matrix covering every extracted requirement:

| Requirement | Category | Match | Evidence and source | Gap or action |
| --- | --- | --- | --- | --- |

### Recruiter assessment

Explain strengths, weaknesses, and likely recruiter concerns based on the comparison. Distinguish demonstrated fit from uncertainty and phrase hiring reactions as assessments rather than predictions.

Give five plausible screening questions, each tied to a role requirement or an evidence gap.

Identify which stated requirements, if any, could give a recruiter grounds to screen the candidate out. Cite the relevant evidence and identify what remains uncertain. If the comparison reveals no such grounds, say so.

## Evidence rules

- Use credible evidence as the basis for coverage; keyword frequency is not a measure of qualification.
- Describe the reported counts as requirement coverage. Do not present them as, or claim to predict, a proprietary ATS score.
