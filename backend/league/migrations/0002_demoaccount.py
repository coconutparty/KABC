from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("league", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="DemoAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("username", models.CharField(max_length=30, unique=True)),
                ("display_name", models.CharField(max_length=40)),
                ("password_hash", models.CharField(max_length=128)),
                ("token", models.CharField(max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
