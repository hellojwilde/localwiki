from models import Page, slugify
from forms import PageForm
from django.views.generic.simple import direct_to_template
from django.views.generic import DetailView, UpdateView, ListView
from django.utils.decorators import classonlymethod

from django.http import HttpResponseNotFound
from django.core.urlresolvers import reverse
from django.shortcuts import get_object_or_404, redirect

from ckeditor.views import ck_upload

from utils.views import Custom404Mixin, CreateObjectMixin
from models import Page
from forms import PageForm


def fix_slug(func):
    """Applies custom slugify to the slug
    """
    def wrapped(*args, **kwargs):
        if 'slug' in kwargs:
            kwargs['original_slug'] = kwargs['slug']
            kwargs['slug'] = slugify(kwargs['slug'])
        return func(*args, **kwargs)
    return wrapped


class SlugifyMixin(object):
    """Applies custom slugify to the slug in generic class-based views
    """
    @classonlymethod
    def as_view(cls, **initargs):
        return fix_slug(super(SlugifyMixin, cls).as_view(**initargs))


class PageDetailView(SlugifyMixin, Custom404Mixin, DetailView):
    model = Page
    context_object_name = 'page'

    def handler404(self, request, *args, **kwargs):
        return HttpResponseNotFound(
            direct_to_template(request, 'pages/page_new.html',
                               {'name': kwargs['original_slug']})
        )

    def get_context_data(self, **kwargs):
        context = super(PageDetailView, self).get_context_data(**kwargs)
        context['date'] = self.object.history.most_recent().history_info.date
        return context


class PageVersionDetailView(PageDetailView):
    template_name = 'pages/page_detail.html'

    def get_object(self):
        page = super(PageVersionDetailView, self).get_object()
        return page.history.as_of(version=int(self.kwargs['version']))

    def get_context_data(self, **kwargs):
        # we don't want PageDetailView's context, skip to DetailView's
        context = super(DetailView, self).get_context_data(**kwargs)
        context['date'] = self.object.history_info.date
        context['show_revision'] = True
        return context


class PageUpdateView(SlugifyMixin, CreateObjectMixin, UpdateView):
    model = Page
    form_class = PageForm

    def get_success_url(self):
        return reverse('show-page', args=[self.object.pretty_slug])

    def create_object(self):
        return Page(name=self.kwargs['original_slug'])


class PageHistoryView(SlugifyMixin, ListView):
    context_object_name = "version_list"
    template_name = "pages/page_history.html"

    def get_queryset(self):
        self.page = get_object_or_404(Page, slug__exact=self.kwargs['slug'])
        return self.page.history.all()

    def get_context_data(self, **kwargs):
        context = super(PageHistoryView, self).get_context_data(**kwargs)
        context['page'] = self.page
        return context


@fix_slug
def compare(request, slug, version1=None, version2=None, **kwargs):
    versions = request.GET.getlist('version')
    if not versions:
        versions = [v for v in (version1, version2) if v]
    if not versions:
        return redirect(reverse('page-history', args=[slug]))
    page = get_object_or_404(Page, slug__exact=slug)
    versions = [int(v) for v in versions]
    old = min(versions)
    new = max(versions)
    if len(versions) == 1:
        old = max(new - 1, 1)
    old_version = page.history.as_of(version=old)
    new_version = page.history.as_of(version=new)
    context = {'old': old_version, 'new': new_version, 'page': page}
    return direct_to_template(request, 'pages/page_diff.html', context)


@fix_slug
def upload(request, slug, **kwargs):
    return ck_upload(request, 'ck_upload/')
