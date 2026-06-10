from django.urls import path

from . import views

urlpatterns = [
    path("state/", views.state),
    path("register/", views.register),
    path("login/", views.login),
    path("reset/", views.reset),
    path("snapshot/", views.snapshot),
]
