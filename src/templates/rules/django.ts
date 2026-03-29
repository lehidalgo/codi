import { PROJECT_NAME } from "../../constants.js";

export const template = `---
name: {{name}}
description: Django conventions — fat models, QuerySet optimization, DRF serializers, migrations, testing
priority: medium
alwaysApply: false
managed_by: ${PROJECT_NAME}
language: python
---

# Django Conventions

## Fat Models, Thin Views
- Place business logic in models and custom managers — views should only dispatch; testable logic should not depend on HTTP
- Use model methods for operations on a single instance
- Use custom managers and QuerySet methods for operations on collections
- Keep views under 20 lines — extract logic into services or model methods

\`\`\`python
# models.py — business logic lives here
class ArticleQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status="published", publish_date__lte=timezone.now())

    def by_author(self, user):
        return self.filter(author=user)


class Article(models.Model):
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=20, default="draft")
    publish_date = models.DateTimeField(null=True, blank=True)
    author = models.ForeignKey("auth.User", on_delete=models.CASCADE)

    objects = ArticleQuerySet.as_manager()

    def publish(self):
        self.status = "published"
        self.publish_date = timezone.now()
        self.save(update_fields=["status", "publish_date"])
\`\`\`

## QuerySet Optimization
- Use \`select_related()\` for ForeignKey and OneToOne fields accessed in the same request
- Use \`prefetch_related()\` for ManyToMany and reverse ForeignKey lookups
- Use \`only()\` or \`defer()\` to limit columns when full model loading is unnecessary
- Use \`iterator()\` for large querysets that do not need caching — avoids loading all rows into memory
- Never evaluate querysets in templates with additional queries — prefetch in the view

\`\`\`python
# BAD: N+1 queries — each article.author triggers a separate query
articles = Article.objects.all()

# GOOD: single JOIN, no N+1
articles = Article.objects.select_related("author").published()
\`\`\`

## Async Views & ORM
- Use \`async def\` views for I/O-bound endpoints — async views avoid thread-pool exhaustion under high concurrency
- Use async ORM methods (\`aget()\`, \`afilter()\`, \`acreate()\`, \`acount()\`) in async views — mixing sync ORM in async views triggers sync_to_async overhead
- Ensure all middleware supports async — a single sync middleware forces Django to use a thread per request
- Deploy with Uvicorn or Hypercorn for ASGI — required for async views to deliver concurrency benefits

## GeneratedField (Django 5.0+)
- Use \`GeneratedField\` for database-computed columns instead of Python \`@property\` — values are queryable, indexable, and computed at the database level
- Choose \`db_persist=True\` (stored) for frequently read values, \`db_persist=False\` (virtual) for rarely accessed computed values

## Security Defaults
- Use \`LoginRequiredMiddleware\` (Django 5.1+) to require authentication by default — decorate public views with \`@login_not_required\`
- This inverts the security model from opt-in to opt-out — prevents accidentally exposing views

## DRF Serializers
- Use \`validate_<field>()\` methods for field-level validation
- Use \`validate()\` for cross-field validation
- Keep serializers focused — use separate serializers for list vs detail
- Use \`SerializerMethodField\` sparingly — prefer annotated querysets for computed fields
- Consider Django Ninja for new API projects — Pydantic-based validation, async-first, auto-generated OpenAPI docs

## Migrations
- Use \`django.db.migrations\` for all schema changes — never write manual SQL for schema
- Run \`makemigrations\` and \`migrate\` in development before pushing
- Review generated migrations — squash when the chain grows beyond 10 per app
- Use \`RunPython\` with a reverse function for data migrations

## Transactions
- Wrap multi-step database operations in \`@transaction.atomic\` — partial writes leave data in an inconsistent state
- Use \`select_for_update()\` when concurrent writes to the same rows are possible — prevents lost updates
- Keep transactions short — do not include external API calls inside atomic blocks; slow calls hold locks and block other requests

## Settings
- Split settings into \`base.py\`, \`dev.py\`, and \`prod.py\`
- Load secrets from environment variables using \`os.environ.get()\` or \`django-environ\`
- Never commit \`.env\` files — add them to \`.gitignore\`

## Testing
- Use \`pytest-django\` with the \`@pytest.mark.django_db\` marker
- Use factories (\`factory_boy\`) instead of fixtures for test data
- Test views via the Django test client or DRF's \`APIClient\`
- Isolate tests — each test must create its own data and clean up
`;
